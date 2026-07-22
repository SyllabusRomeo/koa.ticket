import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationDigestService } from './notification-digest.service';

/**
 * Interval worker (IMAP-style) that checks users due for daily/weekly digests.
 * Default: every 60 minutes. Override with DIGEST_POLL_MINUTES (1–180).
 * Set DIGEST_ENABLED=false to disable.
 */
@Injectable()
export class NotificationDigestPoller
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDigestPoller.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly digests: NotificationDigestService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Notification digest poller disabled (DIGEST_ENABLED=false)');
      return;
    }
    const minutes = this.pollIntervalMinutes();
    this.logger.log(
      `Notification digest poller enabled — every ${minutes}m (sendHour=${this.digests.sendHour()}, weekday=${this.digests.weeklyWeekday()})`,
    );
    void this.tick().catch((err) =>
      this.logger.warn(
        `Initial digest tick failed: ${err instanceof Error ? err.message : err}`,
      ),
    );
    this.timer = setInterval(
      () => {
        void this.tick().catch((err) =>
          this.logger.warn(
            `Digest tick failed: ${err instanceof Error ? err.message : err}`,
          ),
        );
      },
      minutes * 60_000,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isEnabled(): boolean {
    const raw = this.config.get<string>('DIGEST_ENABLED')?.trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'off') return false;
    return true;
  }

  pollIntervalMinutes(): number {
    const raw = Number(this.config.get('DIGEST_POLL_MINUTES') ?? '60');
    if (!Number.isFinite(raw) || raw < 1) return 60;
    return Math.min(raw, 180);
  }

  status() {
    return {
      enabled: this.isEnabled(),
      pollMinutes: this.pollIntervalMinutes(),
      sendHour: this.digests.sendHour(),
      weeklyWeekday: this.digests.weeklyWeekday(),
      note: 'Checks due users each tick; emails unread notifications since lastDigestAt. In-app rows stay unread.',
    };
  }

  async tick() {
    if (this.running) return { skipped: true as const, reason: 'already_running' };
    this.running = true;
    try {
      return await this.digests.processDueDigests();
    } finally {
      this.running = false;
    }
  }
}
