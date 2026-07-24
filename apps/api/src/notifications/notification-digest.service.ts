import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  DIGEST_FREQUENCIES,
  type DigestFrequency,
  isDigestDue,
  isDigestFrequency,
} from './notification-digest.util';

const DEFAULT_TZ = 'Africa/Accra';
const MAX_ITEMS = 40;

@Injectable()
export class NotificationDigestService {
  private readonly logger = new Logger(NotificationDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  frequencies() {
    return DIGEST_FREQUENCIES;
  }

  sendHour(): number {
    const raw = Number(this.config.get('DIGEST_SEND_HOUR') ?? '8');
    if (!Number.isFinite(raw)) return 8;
    return Math.min(23, Math.max(0, Math.trunc(raw)));
  }

  weeklyWeekday(): number {
    const raw = Number(this.config.get('DIGEST_WEEKDAY') ?? '1');
    if (!Number.isFinite(raw)) return 1;
    return Math.min(7, Math.max(1, Math.trunc(raw)));
  }

  async getSettings(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        digestFrequency: true,
        lastDigestAt: true,
        digestQuietStartHour: true,
        digestQuietEndHour: true,
        location: { select: { timezone: true, name: true } },
      },
    });
    if (!user) {
      return {
        frequency: 'none' as DigestFrequency,
        lastDigestAt: null as string | null,
        quietStartHour: null as number | null,
        quietEndHour: null as number | null,
        timezone: DEFAULT_TZ,
        timezoneSource: 'default' as const,
      };
    }
    const frequency = isDigestFrequency(user.digestFrequency)
      ? user.digestFrequency
      : 'none';
    return {
      frequency,
      lastDigestAt: user.lastDigestAt?.toISOString() ?? null,
      quietStartHour: user.digestQuietStartHour,
      quietEndHour: user.digestQuietEndHour,
      timezone: user.location?.timezone ?? DEFAULT_TZ,
      timezoneSource: user.location ? ('location' as const) : ('default' as const),
      locationName: user.location?.name ?? null,
    };
  }

  async updateSettings(
    userId: string,
    data: {
      frequency?: DigestFrequency;
      quietStartHour?: number | null;
      quietEndHour?: number | null;
    },
  ) {
    const update: {
      digestFrequency?: string;
      digestQuietStartHour?: number | null;
      digestQuietEndHour?: number | null;
    } = {};
    if (data.frequency != null) {
      update.digestFrequency = data.frequency;
    }
    if (data.quietStartHour !== undefined) {
      update.digestQuietStartHour = normalizeHour(data.quietStartHour);
    }
    if (data.quietEndHour !== undefined) {
      update.digestQuietEndHour = normalizeHour(data.quietEndHour);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: update,
    });
    return this.getSettings(userId);
  }

  /**
   * Find due users, send one digest email each, record lastDigestAt.
   * In-app notifications stay unread (documented choice for M8).
   */
  async processDueDigests(now = new Date()): Promise<{
    checked: number;
    sent: number;
    skippedEmpty: number;
    skippedSmtp: number;
    errors: number;
  }> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        digestFrequency: { in: ['daily', 'weekly'] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        digestFrequency: true,
        lastDigestAt: true,
        digestQuietStartHour: true,
        digestQuietEndHour: true,
        location: { select: { timezone: true } },
      },
      take: 500,
    });

    let sent = 0;
    let skippedEmpty = 0;
    let skippedSmtp = 0;
    let errors = 0;
    const sendHour = this.sendHour();
    const weeklyWeekday = this.weeklyWeekday();
    const smtpOk = this.email.isConfigured();

    for (const user of users) {
      const frequency = isDigestFrequency(user.digestFrequency)
        ? user.digestFrequency
        : 'none';
      if (frequency === 'none') continue;

      const due = isDigestDue({
        frequency,
        lastDigestAt: user.lastDigestAt,
        now,
        timeZone: user.location?.timezone ?? DEFAULT_TZ,
        quietStartHour: user.digestQuietStartHour,
        quietEndHour: user.digestQuietEndHour,
        sendHour,
        weeklyWeekday,
      });
      if (!due) continue;

      try {
        const result = await this.sendDigestForUser(user.id, {
          email: user.email,
          firstName: user.firstName,
          frequency,
          lastDigestAt: user.lastDigestAt,
          now,
          smtpOk,
        });
        if (result === 'sent') sent += 1;
        else if (result === 'empty') skippedEmpty += 1;
        else if (result === 'smtp') skippedSmtp += 1;
      } catch (err) {
        errors += 1;
        this.logger.warn(
          `Digest failed for user=${user.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (sent || errors) {
      this.logger.log(
        `Digest tick: checked=${users.length} sent=${sent} empty=${skippedEmpty} smtp_skip=${skippedSmtp} errors=${errors}`,
      );
    }

    return {
      checked: users.length,
      sent,
      skippedEmpty,
      skippedSmtp,
      errors,
    };
  }

  private async sendDigestForUser(
    userId: string,
    opts: {
      email: string;
      firstName: string;
      frequency: 'daily' | 'weekly';
      lastDigestAt: Date | null;
      now: Date;
      smtpOk: boolean;
    },
  ): Promise<'sent' | 'empty' | 'smtp'> {
    const since = opts.lastDigestAt;
    const unread = await this.prisma.notification.findMany({
      where: {
        userId,
        readAt: null,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ITEMS,
      select: {
        id: true,
        title: true,
        body: true,
        link: true,
        createdAt: true,
      },
    });

    // Still advance lastDigestAt when empty so we don't re-check every hour forever
    // with nothing to say — but only after send window; empty = no email.
    if (unread.length === 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastDigestAt: opts.now },
      });
      return 'empty';
    }

    if (!opts.smtpOk) {
      // Do not advance lastDigestAt — retry when SMTP is configured.
      return 'smtp';
    }

    const base = this.email.publicAppUrl();
    const inboxUrl = `${base}/app/notifications`;
    const label = opts.frequency === 'daily' ? 'Daily' : 'Weekly';
    const count = unread.length;
    const moreNote =
      count >= MAX_ITEMS
        ? `\n(Showing the ${MAX_ITEMS} most recent unread.)\n`
        : '';

    const lines = unread.map((n, i) => {
      const when = n.createdAt.toISOString().slice(0, 16).replace('T', ' ');
      const link = n.link
        ? n.link.startsWith('http')
          ? n.link
          : `${base}${n.link}`
        : inboxUrl;
      return `${i + 1}. ${n.title}\n   ${n.body}\n   ${when} UTC · ${link}`;
    });

    const text = [
      `Hi ${opts.firstName},`,
      '',
      `Your ${label.toLowerCase()} LogIt digest — ${count} unread notification${count === 1 ? '' : 's'}:`,
      moreNote,
      ...lines,
      '',
      `Inbox: ${inboxUrl}`,
      '',
      'In-app items stay unread until you open them.',
      '',
      '— LogIt',
    ].join('\n');

    const htmlItems = unread
      .map((n) => {
        const link = n.link
          ? n.link.startsWith('http')
            ? n.link
            : `${base}${n.link}`
          : inboxUrl;
        return `<li style="margin-bottom:0.75rem"><strong>${escapeHtml(n.title)}</strong><br/>${escapeHtml(n.body).replace(/\n/g, '<br/>')}<br/><a href="${escapeHtml(link)}">Open</a></li>`;
      })
      .join('');

    const html = `<p>Hi ${escapeHtml(opts.firstName)},</p>
<p>Your <strong>${escapeHtml(label.toLowerCase())}</strong> LogIt digest — <strong>${count}</strong> unread notification${count === 1 ? '' : 's'}:${count >= MAX_ITEMS ? ` (showing ${MAX_ITEMS} most recent)` : ''}</p>
<ul>${htmlItems}</ul>
<p><a href="${escapeHtml(inboxUrl)}">Open notification inbox</a></p>
<p><em>In-app items stay unread until you open them.</em></p>
<p>— LogIt</p>`;

    const result = await this.email.send({
      to: opts.email,
      subject: `[LogIt] ${label} digest — ${count} unread`,
      text,
      html,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    // Advance even if SMTP skipped (misconfig) only when ok — already handled smtpOk.
    // Leave in-app notifications unread; only record digest watermark.
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastDigestAt: opts.now },
    });

    return 'sent';
  }
}

function normalizeHour(v: number | null): number | null {
  if (v == null) return null;
  if (!Number.isFinite(v)) return null;
  return Math.min(23, Math.max(0, Math.trunc(v)));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
