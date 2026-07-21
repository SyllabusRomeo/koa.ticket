import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type EmailSendResult =
  | { ok: true; messageId?: string; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

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
        note: 'POST JSON or form fields: from, subject, text|html. Subject token [INC-2026-…] comments; else creates ticket.',
      },
      imap: {
        implemented: false,
        note: 'IMAP poller is a stub — use inbound webhook (SendGrid/Mailgun parse) for MVP.',
      },
      appPublicUrl: this.publicAppUrl(),
    };
  }

  /** IMAP poller placeholder — not implemented in MVP. */
  pollImapOnce(): { ok: false; reason: string } {
    return {
      ok: false,
      reason: 'IMAP poller not implemented; configure inbound webhook instead.',
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
      });
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
    return this.send({ to: opts.to, subject, text, html });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
