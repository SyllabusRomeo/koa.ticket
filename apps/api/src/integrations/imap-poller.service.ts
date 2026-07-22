import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { IntegrationsService } from './integrations.service';

export type ImapPollResult = {
  ok: boolean;
  processed: number;
  skipped: number;
  errors: number;
  reason?: string;
};

@Injectable()
export class ImapPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapPollerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly integrations: IntegrationsService,
  ) {}

  onModuleInit() {
    if (!this.isConfigured()) return;
    const minutes = this.pollIntervalMinutes();
    this.logger.log(
      `IMAP poller enabled — every ${minutes}m (mailbox ${this.mailbox()})`,
    );
    void this.pollOnce().catch((err) =>
      this.logger.warn(
        `Initial IMAP poll failed: ${err instanceof Error ? err.message : err}`,
      ),
    );
    this.timer = setInterval(
      () => {
        void this.pollOnce().catch((err) =>
          this.logger.warn(
            `IMAP poll failed: ${err instanceof Error ? err.message : err}`,
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

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('IMAP_HOST')?.trim() &&
        this.config.get<string>('IMAP_USER')?.trim() &&
        (this.config.get<string>('IMAP_PASS')?.trim() ||
          this.config.get<string>('IMAP_PASSWORD')?.trim()),
    );
  }

  pollIntervalMinutes(): number {
    const raw = Number(this.config.get('IMAP_POLL_MINUTES') ?? '5');
    if (!Number.isFinite(raw) || raw < 1) return 5;
    return Math.min(raw, 60);
  }

  mailbox(): string {
    return this.config.get<string>('IMAP_MAILBOX')?.trim() || 'INBOX';
  }

  status() {
    const configured = this.isConfigured();
    return {
      implemented: true,
      configured,
      host: configured
        ? `${this.config.get('IMAP_HOST')}:${this.config.get('IMAP_PORT') ?? '993'}`
        : null,
      mailbox: this.mailbox(),
      pollMinutes: this.pollIntervalMinutes(),
      note: configured
        ? 'Polling UNSEEN mail; threads via Message-ID / In-Reply-To / subject token.'
        : 'Set IMAP_HOST, IMAP_USER, IMAP_PASS to enable the poller (webhook still works).',
    };
  }

  async pollOnce(): Promise<ImapPollResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        processed: 0,
        skipped: 0,
        errors: 0,
        reason: 'imap_not_configured',
      };
    }
    if (this.running) {
      return {
        ok: true,
        processed: 0,
        skipped: 0,
        errors: 0,
        reason: 'already_running',
      };
    }

    this.running = true;
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    const host = this.config.get<string>('IMAP_HOST')!.trim();
    const port = Number(this.config.get('IMAP_PORT') ?? '993') || 993;
    const user = this.config.get<string>('IMAP_USER')!.trim();
    const pass =
      this.config.get<string>('IMAP_PASS')?.trim() ||
      this.config.get<string>('IMAP_PASSWORD')?.trim() ||
      '';
    const secure =
      this.config.get('IMAP_TLS') !== 'false' &&
      this.config.get('IMAP_SECURE') !== 'false';

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(this.mailbox());
      try {
        for await (const msg of client.fetch(
          { seen: false },
          { source: true, uid: true },
        )) {
          try {
            if (!msg.source) {
              skipped += 1;
              continue;
            }
            const parsed = await simpleParser(msg.source);
            const from =
              parsed.from?.text ||
              parsed.from?.value?.[0]?.address ||
              '';
            const payload: Record<string, unknown> = {
              from,
              subject: parsed.subject ?? '',
              text: parsed.text ?? '',
              html: typeof parsed.html === 'string' ? parsed.html : '',
              messageId: parsed.messageId ?? undefined,
              inReplyTo: parsed.inReplyTo ?? undefined,
              references: Array.isArray(parsed.references)
                ? parsed.references.join(' ')
                : (parsed.references ?? undefined),
            };

            const result = await this.integrations.handleInboundEmail(payload);
            if (result.action === 'duplicate') skipped += 1;
            else processed += 1;

            if (typeof msg.uid === 'number') {
              await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
            }
          } catch (err) {
            errors += 1;
            this.logger.warn(
              `IMAP message failed: ${err instanceof Error ? err.message : err}`,
            );
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
      return { ok: true, processed, skipped, errors };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`IMAP connect/poll error: ${reason}`);
      try {
        client.close();
      } catch {
        /* ignore */
      }
      return { ok: false, processed, skipped, errors, reason };
    } finally {
      this.running = false;
    }
  }
}
