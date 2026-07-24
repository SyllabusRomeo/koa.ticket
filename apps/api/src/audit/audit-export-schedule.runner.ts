import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { AuditService } from './audit.service';

type ScheduleRow = {
  id: string;
  userId: string;
  cadence: string;
  email: string;
  filters: unknown;
  lastRunAt: Date | null;
  isActive: boolean;
};

/**
 * Polls active AuditExportSchedule rows and emails checksummed CSV exports.
 * Disable with AUDIT_EXPORT_SCHEDULE_ENABLED=false.
 */
@Injectable()
export class AuditExportScheduleRunner
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AuditExportScheduleRunner.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Audit export schedule runner disabled');
      return;
    }
    const minutes = this.pollIntervalMinutes();
    this.logger.log(`Audit export schedule runner — every ${minutes}m`);
    void this.runDue().catch((err) =>
      this.logger.warn(
        `Initial audit schedule run failed: ${err instanceof Error ? err.message : err}`,
      ),
    );
    this.timer = setInterval(() => {
      void this.runDue().catch((err) =>
        this.logger.warn(
          `Audit schedule run failed: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }, minutes * 60_000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isEnabled(): boolean {
    const raw = this.config
      .get<string>('AUDIT_EXPORT_SCHEDULE_ENABLED')
      ?.trim();
    if (raw === 'false' || raw === '0') return false;
    return true;
  }

  pollIntervalMinutes(): number {
    const raw = Number(
      this.config.get('AUDIT_EXPORT_SCHEDULE_POLL_MINUTES') ?? '15',
    );
    if (!Number.isFinite(raw) || raw < 1) return 15;
    return Math.min(raw, 120);
  }

  async runDue(): Promise<{
    processed: number;
    skipped: number;
    errors: number;
  }> {
    if (this.running) {
      return { processed: 0, skipped: 0, errors: 0 };
    }
    this.running = true;
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    try {
      const due = await this.audit.listDueExportSchedules();
      for (const row of due) {
        try {
          const result = await this.executeSchedule(row);
          if (result === 'skipped') skipped += 1;
          else processed += 1;
        } catch (err) {
          errors += 1;
          this.logger.warn(
            `Audit schedule ${row.id} failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
    return { processed, skipped, errors };
  }

  async runOne(userId: string, scheduleId: string) {
    const row = await this.audit.getExportScheduleRow(userId, scheduleId);
    if (!row) return null;
    return this.executeSchedule(row, { force: true });
  }

  private async executeSchedule(
    row: ScheduleRow,
    opts: { force?: boolean } = {},
  ): Promise<'ok' | 'skipped'> {
    if (!opts.force && !row.isActive) return 'skipped';

    const exportPayload = await this.audit.buildScheduledAuditExport(row);
    const rangeLabel = `${exportPayload.range.from} → ${exportPayload.range.to}`;
    const subject = `LogIt ${row.cadence} audit export (SHA-256)`;
    const text = [
      'Your scheduled LogIt audit CSV is attached.',
      '',
      `Cadence: ${row.cadence}`,
      `Rows: ${exportPayload.rowCount}`,
      `Range: ${rangeLabel}`,
      `SHA-256: ${exportPayload.contentSha256}`,
      '',
      'Store this hash with the file to verify integrity later.',
      'Manage schedules in LogIt → Audit trail.',
      '— LogIt',
    ].join('\n');

    const sendResult = await this.email.send({
      to: row.email,
      subject,
      text,
      html: `<p>Your scheduled LogIt audit CSV is attached.</p>
<p>${escapeHtml(rangeLabel)} · ${escapeHtml(row.cadence)} · ${exportPayload.rowCount} rows</p>
<p><code>SHA-256: ${escapeHtml(exportPayload.contentSha256)}</code></p>
<p>Store this hash with the file to verify integrity later.</p>
<p>— LogIt</p>`,
      attachments: [
        {
          filename: exportPayload.filename,
          content: Buffer.from(exportPayload.body, 'utf8'),
          contentType: exportPayload.contentType,
        },
      ],
    });

    if (!sendResult.ok) {
      throw new Error(sendResult.error);
    }

    await this.audit.markExportScheduleRan(row.id);
    await this.audit.log({
      actorId: row.userId,
      action: 'audit.schedule.run',
      entityType: 'audit_export_schedule',
      entityId: row.id,
      after: {
        cadence: row.cadence,
        email: row.email,
        runId: exportPayload.runId,
        rowCount: exportPayload.rowCount,
        contentSha256: exportPayload.contentSha256,
        from: exportPayload.range.from,
        to: exportPayload.range.to,
        skipped: 'skipped' in sendResult && sendResult.skipped === true,
        reason:
          'skipped' in sendResult && sendResult.skipped
            ? sendResult.reason
            : undefined,
      },
    });

    if ('skipped' in sendResult && sendResult.skipped) {
      this.logger.log(
        `Audit schedule ${row.id} prepared but SMTP skipped (${sendResult.reason})`,
      );
      return 'skipped';
    }

    this.logger.log(`Audit schedule ${row.id} emailed to ${row.email}`);
    return 'ok';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
