import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ROLES } from '@logit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, type AuthUserView } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import {
  cleanEmailSubjectTitle,
  extractTicketNumberFromSubject,
} from '../email/email-subject.parser';
import { TicketsService } from '../tickets/tickets.service';
import { parseChatTicketMessage } from './chat-message.parser';

export type ChatTicketResult = {
  ok: true;
  channel: 'slack' | 'teams' | 'simulate';
  ticketNumber: string;
  ticketId: string;
  title: string;
  url: string;
  confirmation: string;
};

export type EmailInboundResult = {
  ok: true;
  action: 'comment' | 'create';
  ticketNumber: string;
  ticketId: string;
  url: string;
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly tickets: TicketsService,
    private readonly email: EmailService,
  ) {}

  status() {
    const slackSigning = !!this.config.get('SLACK_SIGNING_SECRET');
    const slackBot = !!this.config.get('SLACK_BOT_TOKEN');
    const teamsAppId = !!this.config.get('TEAMS_APP_ID');
    const teamsSecret = !!(
      this.config.get('TEAMS_APP_PASSWORD') ||
      this.config.get('TEAMS_WEBHOOK_SECRET')
    );
    const publicUrl = this.publicAppUrl();
    const apiBase = this.publicApiUrl();
    const emailStatus = this.email.status();

    return {
      slack: {
        configured: slackSigning || slackBot,
        signingSecret: slackSigning,
        botToken: slackBot,
        eventsUrl: `${apiBase}/integrations/slack/events`,
        slashUrl: `${apiBase}/integrations/slack/commands`,
      },
      teams: {
        configured: teamsAppId || teamsSecret,
        appId: teamsAppId,
        webhookSecret: teamsSecret,
        messagesUrl: `${apiBase}/integrations/teams/messages`,
      },
      email: emailStatus,
      serviceUserEmail:
        this.config.get('INTEGRATION_SERVICE_USER_EMAIL') ??
        this.config.get('SEED_ADMIN_EMAIL') ??
        'admin@logit.local',
      appPublicUrl: publicUrl,
      examples: [
        '/logit laptop broken priority:high',
        '@LogIT create: VPN down priority:p2',
        'Printer offline impact:medium urgency:low',
      ],
    };
  }

  publicAppUrl() {
    return (
      this.config.get('APP_PUBLIC_URL') ??
      this.config.get('APP_URL') ??
      'http://localhost:3100'
    ).replace(/\/$/, '');
  }

  publicApiUrl() {
    const fromEnv = this.config.get('API_PUBLIC_URL');
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    const port = this.config.get('API_PORT') ?? '4100';
    return `http://localhost:${port}/api/v1`;
  }

  ticketUrl(number: string) {
    return `${this.publicAppUrl()}/app/tickets/${encodeURIComponent(number)}`;
  }

  verifySlackSignature(
    rawBody: Buffer | string | undefined,
    timestamp: string | undefined,
    signature: string | undefined,
  ) {
    const secret = this.config.get<string>('SLACK_SIGNING_SECRET');
    if (!secret) {
      // Dev mode: allow when secret not configured
      return;
    }
    if (!rawBody || !timestamp || !signature) {
      throw new UnauthorizedException('Missing Slack signature headers');
    }
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) {
      throw new UnauthorizedException('Slack request timestamp expired');
    }
    const body =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const base = `v0:${timestamp}:${body}`;
    const digest = `v0=${createHmac('sha256', secret).update(base).digest('hex')}`;
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid Slack signature');
    }
  }

  verifyTeamsSecret(authHeader: string | undefined) {
    const secret =
      this.config.get<string>('TEAMS_WEBHOOK_SECRET') ||
      this.config.get<string>('TEAMS_APP_PASSWORD');
    if (!secret) return;
    if (!authHeader) {
      throw new UnauthorizedException('Missing Teams authorization');
    }
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid Teams secret');
    }
  }

  async resolveActor(opts: {
    email?: string | null;
    displayName?: string | null;
  }): Promise<AuthUserView> {
    const email = (opts.email ?? '').trim().toLowerCase();
    if (email) {
      const user = await this.prisma.user.findFirst({
        where: { email, deletedAt: null, isActive: true },
        include: {
          roles: {
            include: {
              role: {
                include: { permissions: { include: { permission: true } } },
              },
            },
          },
          extraPermissions: { include: { permission: true } },
        },
      });
      if (user) return this.auth.toAuthUser(user);
    }

    const serviceEmail = (
      this.config.get('INTEGRATION_SERVICE_USER_EMAIL') ??
      this.config.get('SEED_ADMIN_EMAIL') ??
      'admin@logit.local'
    )
      .trim()
      .toLowerCase();

    const service = await this.prisma.user.findFirst({
      where: { email: serviceEmail, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        extraPermissions: { include: { permission: true } },
      },
    });
    if (!service) {
      throw new BadRequestException(
        `Integration service user not found (${serviceEmail}). Set INTEGRATION_SERVICE_USER_EMAIL.`,
      );
    }
    return this.auth.toAuthUser(service);
  }

  async createFromChat(opts: {
    channel: 'slack' | 'teams' | 'simulate';
    text: string;
    email?: string | null;
    displayName?: string | null;
  }): Promise<ChatTicketResult> {
    const parsed = parseChatTicketMessage(opts.text);
    const actor = await this.resolveActor({
      email: opts.email,
      displayName: opts.displayName,
    });

    const sourceNote = [
      `Source: ${opts.channel}`,
      opts.displayName ? `Chat user: ${opts.displayName}` : null,
      opts.email ? `Email: ${opts.email}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const ticket = (await this.tickets.create(actor, {
      title: parsed.title,
      description: `${parsed.description}\n\n---\n${sourceNote}`,
      typeCode: parsed.typeCode,
      impact: parsed.impact,
      urgency: parsed.urgency,
    })) as unknown as { id: string; number: string; title: string };

    const url = this.ticketUrl(ticket.number);
    const confirmation = `Created ${ticket.number}: ${ticket.title}\n${url}`;

    return {
      ok: true,
      channel: opts.channel,
      ticketNumber: ticket.number,
      ticketId: ticket.id,
      title: ticket.title,
      url,
      confirmation,
    };
  }

  assertSysadmin(user: AuthUserView) {
    if (!user.roles.includes(ROLES.SYSADMIN)) {
      throw new ForbiddenException('Sysadmin only');
    }
  }

  verifyEmailInboundSecret(authHeader: string | undefined) {
    const secret = this.config.get<string>('EMAIL_INBOUND_SECRET')?.trim();
    if (!secret) return;
    if (!authHeader) {
      throw new UnauthorizedException('Missing email inbound authorization');
    }
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid email inbound secret');
    }
  }

  /**
   * Accept SendGrid/Mailgun-style inbound parse payloads (JSON or form fields).
   * Subject containing [INC-2026-…] → public comment; otherwise create incident.
   */
  async handleInboundEmail(raw: Record<string, unknown>): Promise<EmailInboundResult> {
    const from = pickString(raw, [
      'from',
      'sender',
      'From',
      'envelope_from',
    ]);
    const subject = pickString(raw, ['subject', 'Subject']) ?? '';
    const text =
      pickString(raw, ['text', 'plain', 'body-plain', 'stripped-text']) ??
      stripHtml(
        pickString(raw, ['html', 'body-html', 'stripped-html']) ?? '',
      );
    const body = (text || '(empty email body)').trim();

    const fromEmail = extractEmailAddress(from);
    const actor = await this.resolveActor({
      email: fromEmail,
      displayName: from,
    });

    const ticketNumber = extractTicketNumberFromSubject(subject);
    if (ticketNumber) {
      const existing = await this.prisma.ticket.findFirst({
        where: { number: ticketNumber, deletedAt: null },
        select: { id: true, number: true },
      });
      if (!existing) {
        throw new NotFoundException(`Ticket ${ticketNumber} not found`);
      }

      const sourceNote = [
        `Source: email`,
        from ? `From: ${from}` : null,
        subject ? `Subject: ${subject}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await this.tickets.addComment(actor, existing.id, {
        body: `${body}\n\n---\n${sourceNote}`,
        isInternal: false,
      });

      return {
        ok: true,
        action: 'comment',
        ticketNumber: existing.number,
        ticketId: existing.id,
        url: this.ticketUrl(existing.number),
      };
    }

    const title = cleanEmailSubjectTitle(subject);
    const sourceNote = [
      `Source: email`,
      from ? `From: ${from}` : null,
      subject ? `Subject: ${subject}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const ticket = (await this.tickets.create(actor, {
      title,
      description: `${body}\n\n---\n${sourceNote}`,
      typeCode: 'incident',
    })) as unknown as { id: string; number: string };

    return {
      ok: true,
      action: 'create',
      ticketNumber: ticket.number,
      ticketId: ticket.id,
      url: this.ticketUrl(ticket.number),
    };
  }
}

function pickString(
  raw: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function extractEmailAddress(from: string | null): string | null {
  if (!from) return null;
  const angle = from.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  if (from.includes('@')) return from.trim().toLowerCase();
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
