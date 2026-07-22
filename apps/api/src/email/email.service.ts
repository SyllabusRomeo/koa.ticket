import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatMessageIdHeader,
  normalizeMessageId,
} from './email-headers';

export type EmailSendResult =
  | { ok: true; messageId?: string; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** SMTP is usable when host + from address are set. */
  isConfigured(): boolean {
    return Boolean(this.smtpHost() && this.fromAddress());
  }

  smtpHost(): string | undefined {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    return host || undefined;
  }

  smtpPort(): number {
    const raw = this.config.get<string>('SMTP_PORT') ?? '587';
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 587;
  }

  smtpUser(): string | undefined {
    return this.config.get<string>('SMTP_USER')?.trim() || undefined;
  }

  smtpPass(): string | undefined {
    return (
      this.config.get<string>('SMTP_PASS')?.trim() ||
      this.config.get<string>('SMTP_PASSWORD')?.trim() ||
      undefined
    );
  }

  fromAddress(): string | undefined {
    return (
      this.config.get<string>('EMAIL_FROM')?.trim() ||
      this.config.get<string>('SMTP_FROM')?.trim() ||
      undefined
    );
  }

  inboundSecretConfigured(): boolean {
    return Boolean(this.config.get<string>('EMAIL_INBOUND_SECRET')?.trim());
  }

  publicAppUrl(): string {
    return (
      this.config.get('APP_PUBLIC_URL') ??
      this.config.get('APP_URL') ??
      'http://localhost:3100'
    ).replace(/\/$/, '');
  }

  publicApiUrl(): string {
    const fromEnv = this.config.get('API_PUBLIC_URL');
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    const port = this.config.get('API_PORT') ?? '4100';
    return `http://localhost:${port}/api/v1`;
  }

  status() {
    const host = this.smtpHost();
    const from = this.fromAddress();
    const configured = this.isConfigured();
    const apiBase = this.publicApiUrl();
    const imapHost = this.config.get<string>('IMAP_HOST')?.trim();
    return {
      configured,
      outbound: {
        configured,
        host: Boolean(host),
        hostValue: host ? `${host}:${this.smtpPort()}` : null,
        user: Boolean(this.smtpUser()),
        from: from ?? null,
      },
      inbound: {
        webhookUrl: `${apiBase}/integrations/email/inbound`,
        secretConfigured: this.inboundSecretConfigured(),
        note: 'POST from, subject, text|html, optional messageId / inReplyTo / references. Subject token or reply headers thread comments.',
      },
      imap: {
        implemented: true,
        configured: Boolean(
          imapHost &&
            this.config.get<string>('IMAP_USER')?.trim() &&
            (this.config.get<string>('IMAP_PASS')?.trim() ||
              this.config.get<string>('IMAP_PASSWORD')?.trim()),
        ),
        host: imapHost
          ? `${imapHost}:${this.config.get('IMAP_PORT') ?? '993'}`
          : null,
        mailbox: this.config.get<string>('IMAP_MAILBOX')?.trim() || 'INBOX',
        pollMinutes: Number(this.config.get('IMAP_POLL_MINUTES') ?? '5') || 5,
        note: imapHost
          ? 'IMAP poller active when API is running (UNSEEN → ticket create/comment).'
          : 'Set IMAP_HOST, IMAP_USER, IMAP_PASS to enable polling (webhook still works).',
      },
      appPublicUrl: this.publicAppUrl(),
    };
  }

  private getTransporter(): Transporter | null {
    if (!this.isConfigured()) return null;
    if (this.transporter) return this.transporter;

    const host = this.smtpHost()!;
    const port = this.smtpPort();
    const user = this.smtpUser();
    const pass = this.smtpPass();

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  async send(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    inReplyTo?: string | null;
    references?: string[];
    ticketId?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>;
  }): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      this.logger.log(
        `SMTP not configured — skip email to=${opts.to} subject=${opts.subject}`,
      );
      return { ok: true, skipped: true, reason: 'smtp_not_configured' };
    }

    const transport = this.getTransporter();
    if (!transport) {
      return { ok: true, skipped: true, reason: 'smtp_not_configured' };
    }

    try {
      const info = await transport.sendMail({
        from: this.fromAddress(),
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        attachments: opts.attachments,
        inReplyTo: opts.inReplyTo
          ? formatMessageIdHeader(opts.inReplyTo)
          : undefined,
        references: opts.references?.length
          ? opts.references.map((id) => formatMessageIdHeader(id))
          : undefined,
      });

      const messageId = normalizeMessageId(info.messageId);
      if (messageId && opts.ticketId) {
        try {
          await this.prisma.emailMessage.upsert({
            where: { messageId },
            create: {
              messageId,
              inReplyTo: opts.inReplyTo
                ? normalizeMessageId(opts.inReplyTo)
                : null,
              references: opts.references?.length
                ? opts.references
                    .map((r) => normalizeMessageId(r) ?? r)
                    .join(' ')
                : null,
              direction: 'outbound',
              ticketId: opts.ticketId,
              subject: opts.subject,
              fromAddress: this.fromAddress() ?? null,
              toAddress: opts.to,
            },
            update: {},
          });
        } catch (err) {
          this.logger.warn(
            `Failed to persist outbound Message-ID: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      return { ok: true, messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`SMTP send failed to=${opts.to}: ${message}`);
      return { ok: false, error: message };
    }
  }

  /** Build a simple ticket event email (plain text + light HTML). */
  async sendTicketEvent(opts: {
    to: string;
    ticketNumber: string;
    title: string;
    eventLabel: string;
    body: string;
    linkPath?: string;
    inReplyTo?: string | null;
    references?: string[];
    ticketId?: string;
  }): Promise<EmailSendResult> {
    const base = this.publicAppUrl();
    const path =
      opts.linkPath ?? `/app/tickets/${encodeURIComponent(opts.ticketNumber)}`;
    const url = path.startsWith('http') ? path : `${base}${path}`;
    const subject = `[${opts.ticketNumber}] ${opts.eventLabel}: ${opts.title}`;
    const text = [
      opts.eventLabel,
      '',
      opts.body,
      '',
      `Ticket: ${opts.ticketNumber}`,
      `Open: ${url}`,
      '',
      '— LogIT',
    ].join('\n');
    const html = `<p><strong>${escapeHtml(opts.eventLabel)}</strong></p>
<p>${escapeHtml(opts.body).replace(/\n/g, '<br/>')}</p>
<p>Ticket: <code>${escapeHtml(opts.ticketNumber)}</code><br/>
<a href="${escapeHtml(url)}">Open in LogIT</a></p>
<p>— LogIT</p>`;

    let ticketId = opts.ticketId;
    let inReplyTo = opts.inReplyTo;
    let references = opts.references;

    if (!ticketId || inReplyTo === undefined) {
      const ticket = await this.prisma.ticket.findFirst({
        where: { number: opts.ticketNumber, deletedAt: null },
        select: { id: true },
      });
      ticketId = ticketId ?? ticket?.id;
      if (ticket && (inReplyTo === undefined || !references?.length)) {
        const messages = await this.prisma.emailMessage.findMany({
          where: { ticketId: ticket.id },
          orderBy: { createdAt: 'asc' },
          select: { messageId: true, direction: true },
          take: 40,
        });
        references = references?.length
          ? references
          : messages.map((m) => m.messageId);
        if (inReplyTo === undefined) {
          const lastInbound = [...messages]
            .reverse()
            .find((m) => m.direction === 'inbound');
          inReplyTo =
            lastInbound?.messageId ??
            messages[messages.length - 1]?.messageId ??
            null;
        }
      }
    }

    return this.send({
      to: opts.to,
      subject,
      text,
      html,
      inReplyTo,
      references,
      ticketId,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
