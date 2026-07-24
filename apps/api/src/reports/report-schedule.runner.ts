import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { ReportsService } from './reports.service';

type ScheduleRow = {
  id: string;
  userId: string;
  cadence: string;
  format: string;
  email: string;
  filters: unknown;
  lastRunAt: Date | null;
  isActive: boolean;
};

/**
 * Polls active ReportSchedule rows and emails CSV/PDF exports.
 * Interval mirrors IMAP poller (setInterval); disable with REPORT_SCHEDULE_ENABLED=false.
 */
@Injectable()
export class ReportScheduleRunner
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ReportScheduleRunner.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly reports: ReportsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Report schedule runner disabled');
      return;
    }
    const minutes = this.pollIntervalMinutes();
    this.logger.log(`Report schedule runner — every ${minutes}m`);
    void this.runDue().catch((err) =>
      this.logger.warn(
        `Initial schedule run failed: ${err instanceof Error ? err.message : err}`,
      ),
    );
    this.timer = setInterval(() => {
      void this.runDue().catch((err) =>
        this.logger.warn(
          `Schedule run failed: ${err instanceof Error ? err.message : err}`,
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
    const raw = this.config.get<string>('REPORT_SCHEDULE_ENABLED')?.trim();
    if (raw === 'false' || raw === '0') return false;
    return true;
  }

  pollIntervalMinutes(): number {
    const raw = Number(
      this.config.get('REPORT_SCHEDULE_POLL_MINUTES') ?? '15',
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
      const due = await this.reports.listDueSchedules();
      for (const row of due) {
        try {
          const result = await this.executeSchedule(row);
          if (result === 'skipped') skipped += 1;
          else processed += 1;
        } catch (err) {
          errors += 1;
          this.logger.warn(
            `Schedule ${row.id} failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
    return { processed, skipped, errors };
  }

  async runOne(userId: string, scheduleId: string) {
    const row = await this.reports.getScheduleRow(userId, scheduleId);
    if (!row) return null;
    return this.executeSchedule(row, { force: true });
  }

  private async executeSchedule(
    row: ScheduleRow,
    opts: { force?: boolean } = {},
  ): Promise<'ok' | 'skipped'> {
    if (!opts.force && !row.isActive) return 'skipped';

    const exportPayload = await this.reports.buildScheduledExport(row);
    const rangeLabel =
      exportPayload.range.from || exportPayload.range.to
        ? `Created ${exportPayload.range.from ?? '…'} → ${exportPayload.range.to ?? '…'}`
        : 'All time';

    const subject = `LogIt ${row.cadence} report (${row.format.toUpperCase()})`;
    const text = [
      'Your scheduled LogIt export is attached.',
      '',
      `Cadence: ${row.cadence}`,
      `Format: ${row.format}`,
      rangeLabel,
      '',
      'Manage schedules in LogIt → Reports.',
      '— LogIt',
    ].join('\n');

    const sendResult = await this.email.send({
      to: row.email,
      subject,
      text,
      html: `<p>Your scheduled LogIt export is attached.</p>
<p>${escapeHtml(rangeLabel)} · ${escapeHtml(row.cadence)} · ${escapeHtml(row.format.toUpperCase())}</p>
<p>— LogIt</p>`,
      attachments: [
        {
          filename: exportPayload.filename,
          content:
            typeof exportPayload.body === 'string'
              ? Buffer.from(exportPayload.body, 'utf8')
              : exportPayload.body,
          contentType: exportPayload.contentType,
        },
      ],
    });

    if (!sendResult.ok) {
      throw new Error(sendResult.error);
    }

    await this.reports.markScheduleRan(row.id);
    await this.audit.log({
      actorId: row.userId,
      action: 'report.schedule.run',
      entityType: 'report_schedule',
      entityId: row.id,
      after: {
        format: row.format,
        cadence: row.cadence,
        email: row.email,
        from: exportPayload.range.from ?? null,
        to: exportPayload.range.to ?? null,
        skipped: 'skipped' in sendResult && sendResult.skipped === true,
        reason:
          'skipped' in sendResult && sendResult.skipped
            ? sendResult.reason
            : undefined,
      },
    });

    if ('skipped' in sendResult && sendResult.skipped) {
      this.logger.log(
        `Schedule ${row.id} prepared but SMTP skipped (${sendResult.reason})`,
      );
      return 'skipped';
    }

    this.logger.log(`Schedule ${row.id} emailed to ${row.email}`);
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
