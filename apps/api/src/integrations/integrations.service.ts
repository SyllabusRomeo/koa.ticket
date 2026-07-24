import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { ROLES } from '@logit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, type AuthUserView } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import {
  normalizeMessageId,
  parseReferencesHeader,
} from '../email/email-headers';
import {
  cleanEmailSubjectTitle,
  extractTicketNumberFromSubject,
} from '../email/email-subject.parser';
import { TicketsService } from '../tickets/tickets.service';
import {
  extractBearerToken,
  verifyBotFrameworkJwt,
  verifySharedBearerSecret,
} from './bot-framework-auth';
import { parseChatTicketMessage } from './chat-message.parser';
import { verifySlackRequestSignature } from './slack-signing';

export type ChatTicketResult = {
  ok: true;
  channel: 'slack' | 'teams' | 'simulate';
  ticketNumber: string;
  ticketId: string;
  title: string;
  url: string;
  confirmation: string;
};

export type EmailInboundResult =
  | {
      ok: true;
      action: 'comment' | 'create';
      ticketNumber: string;
      ticketId: string;
      url: string;
      threadedBy?: 'subject' | 'in_reply_to' | 'references';
    }
  | {
      ok: true;
      action: 'duplicate';
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
    const slackSigning = !!this.slackSigningSecret();
    const slackBot = !!this.config.get('SLACK_BOT_TOKEN');
    const teamsAppId = !!this.teamsAppId();
    const teamsSecret = !!this.teamsWebhookSecret();
    const requireAuth = this.integrationsRequireAuth();
    const publicUrl = this.publicAppUrl();
    const apiBase = this.publicApiUrl();
    const emailStatus = this.email.status();

    return {
      slack: {
        configured: slackSigning || slackBot,
        signingSecret: slackSigning,
        botToken: slackBot,
        authRequired: requireAuth,
        eventsUrl: `${apiBase}/integrations/slack/events`,
        slashUrl: `${apiBase}/integrations/slack/commands`,
      },
      teams: {
        configured: teamsAppId || teamsSecret,
        appId: teamsAppId,
        webhookSecret: teamsSecret,
        jwtVerification: teamsAppId,
        allowEmulator: this.teamsAllowEmulator(),
        authRequired: requireAuth,
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
        '@LogIt create: VPN down priority:p2',
        'Printer offline impact:medium urgency:low',
      ],
    };
  }

  private integrationsRequireAuth() {
    const flag = this.config.get('INTEGRATIONS_REQUIRE_AUTH');
    if (flag === '1' || flag === 'true') return true;
    if (flag === '0' || flag === 'false') return false;
    return this.config.get('NODE_ENV') === 'production';
  }

  private slackSigningSecret() {
    return this.config.get<string>('SLACK_SIGNING_SECRET')?.trim() || '';
  }

  /** Microsoft App ID for Bot Framework JWT audience. */
  private teamsAppId() {
    return (
      this.config.get<string>('TEAMS_APP_ID')?.trim() ||
      this.config.get<string>('MICROSOFT_APP_ID')?.trim() ||
      ''
    );
  }

  /** Shared bearer for simple connectors (not Bot Framework client secret). */
  private teamsWebhookSecret() {
    return this.config.get<string>('TEAMS_WEBHOOK_SECRET')?.trim() || '';
  }

  private teamsAllowEmulator() {
    const v = this.config.get('TEAMS_ALLOW_EMULATOR');
    return v === '1' || v === 'true';
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
    const secret = this.slackSigningSecret();
    if (!secret) {
      if (this.integrationsRequireAuth()) {
        throw new UnauthorizedException(
          'SLACK_SIGNING_SECRET is required when INTEGRATIONS_REQUIRE_AUTH/production is on',
        );
      }
      // Dev mode: allow when secret not configured
      return;
    }
    if (!rawBody || !timestamp || !signature) {
      throw new UnauthorizedException('Missing Slack signature headers');
    }
    const result = verifySlackRequestSignature({
      signingSecret: secret,
      rawBody,
      timestamp,
      signature,
    });
    if (!result.ok) {
      if (result.reason === 'expired') {
        throw new UnauthorizedException('Slack request timestamp expired');
      }
      if (result.reason === 'missing') {
        throw new UnauthorizedException('Missing Slack signature headers');
      }
      throw new UnauthorizedException('Invalid Slack signature');
    }
  }

  /**
   * Teams / Bot Framework inbound auth.
   * Prefer JWT (TEAMS_APP_ID / MICROSOFT_APP_ID + Bot Framework JWKS).
   * Fall back to shared TEAMS_WEBHOOK_SECRET Bearer for simple connectors.
   */
  async verifyTeamsAuth(
    authHeader: string | undefined,
    activity?: { serviceUrl?: unknown },
  ) {
    const appId = this.teamsAppId();
    const sharedSecret = this.teamsWebhookSecret();
    const requireAuth = this.integrationsRequireAuth();

    if (!appId && !sharedSecret) {
      if (requireAuth) {
        throw new UnauthorizedException(
          'TEAMS_APP_ID (JWT) or TEAMS_WEBHOOK_SECRET is required when auth is enforced',
        );
      }
      return { mode: 'open' as const };
    }

    if (!authHeader?.trim()) {
      throw new UnauthorizedException('Missing Teams authorization');
    }

    const bearer = extractBearerToken(authHeader);
    const rawToken = bearer ?? authHeader.trim();

    // JWT path when App ID is configured and token looks like a JWT.
    if (appId && bearer && bearer.split('.').length === 3) {
      const serviceUrl =
        typeof activity?.serviceUrl === 'string' ? activity.serviceUrl : null;
      const jwt = await verifyBotFrameworkJwt({
        token: bearer,
        appId,
        activityServiceUrl: serviceUrl,
        allowEmulator: this.teamsAllowEmulator(),
      });
      if (jwt.ok) {
        return { mode: jwt.mode };
      }
      // If JWT failed but shared secret is configured, try secret next.
      if (!sharedSecret) {
        throw new UnauthorizedException(
          `Invalid Bot Framework JWT (${jwt.reason})`,
        );
      }
    }

    if (sharedSecret) {
      if (!verifySharedBearerSecret(rawToken, sharedSecret)) {
        throw new UnauthorizedException('Invalid Teams webhook secret');
      }
      return { mode: 'shared-secret' as const };
    }

    throw new UnauthorizedException('Invalid Teams authorization');
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
    channelMeta?: Record<string, unknown>;
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

    /** Persist simulate intake as `chat`; Slack/Teams keep their codes. */
    const ticketChannel =
      opts.channel === 'simulate' ? 'chat' : opts.channel;

    const ticket = (await this.tickets.create(actor, {
      title: parsed.title,
      description: `${parsed.description}\n\n---\n${sourceNote}`,
      typeCode: parsed.typeCode,
      impact: parsed.impact,
      urgency: parsed.urgency,
      channel: ticketChannel,
      channelMeta: {
        intake: opts.channel,
        ...(opts.displayName ? { displayName: opts.displayName } : {}),
        ...(opts.email ? { email: opts.email } : {}),
        ...(opts.channelMeta ?? {}),
      },
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
   * Threading: Message-ID / In-Reply-To / References first, then subject token.
   * Dedupe on Message-ID when present.
   */
  async handleInboundEmail(
    raw: Record<string, unknown>,
  ): Promise<EmailInboundResult> {
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

    const messageId = normalizeMessageId(
      pickString(raw, [
        'messageId',
        'message-id',
        'Message-Id',
        'Message-ID',
        'MessageID',
      ]),
    );
    const inReplyTo = normalizeMessageId(
      pickString(raw, [
        'inReplyTo',
        'in-reply-to',
        'In-Reply-To',
        'InReplyTo',
      ]),
    );
    const references = parseReferencesHeader(
      pickString(raw, ['references', 'References']),
    );

    if (messageId) {
      const existingMsg = await this.prisma.emailMessage.findUnique({
        where: { messageId },
        include: { ticket: { select: { id: true, number: true } } },
      });
      if (existingMsg?.ticket) {
        return {
          ok: true,
          action: 'duplicate',
          ticketNumber: existingMsg.ticket.number,
          ticketId: existingMsg.ticket.id,
          url: this.ticketUrl(existingMsg.ticket.number),
        };
      }
    }

    const fromEmail = extractEmailAddress(from);
    const actor = await this.resolveActor({
      email: fromEmail,
      displayName: from,
    });

    let ticketId: string | null = null;
    let ticketNumber: string | null = null;
    let threadedBy: 'subject' | 'in_reply_to' | 'references' | undefined;

    if (inReplyTo) {
      const parent = await this.prisma.emailMessage.findUnique({
        where: { messageId: inReplyTo },
        include: { ticket: { select: { id: true, number: true, deletedAt: true } } },
      });
      if (parent?.ticket && !parent.ticket.deletedAt) {
        ticketId = parent.ticket.id;
        ticketNumber = parent.ticket.number;
        threadedBy = 'in_reply_to';
      }
    }

    if (!ticketId && references.length) {
      for (let i = references.length - 1; i >= 0; i--) {
        const ref = references[i]!;
        const parent = await this.prisma.emailMessage.findUnique({
          where: { messageId: ref },
          include: {
            ticket: { select: { id: true, number: true, deletedAt: true } },
          },
        });
        if (parent?.ticket && !parent.ticket.deletedAt) {
          ticketId = parent.ticket.id;
          ticketNumber = parent.ticket.number;
          threadedBy = 'references';
          break;
        }
      }
    }

    if (!ticketId) {
      const fromSubject = extractTicketNumberFromSubject(subject);
      if (fromSubject) {
        const existing = await this.prisma.ticket.findFirst({
          where: { number: fromSubject, deletedAt: null },
          select: { id: true, number: true },
        });
        if (!existing) {
          throw new NotFoundException(`Ticket ${fromSubject} not found`);
        }
        ticketId = existing.id;
        ticketNumber = existing.number;
        threadedBy = 'subject';
      }
    }

    const sourceNote = [
      `Source: email`,
      from ? `From: ${from}` : null,
      subject ? `Subject: ${subject}` : null,
      messageId ? `Message-ID: ${messageId}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (ticketId && ticketNumber) {
      const comment = await this.tickets.addComment(actor, ticketId, {
        body: `${body}\n\n---\n${sourceNote}`,
        isInternal: false,
      });

      if (messageId) {
        await this.recordEmailMessage({
          messageId,
          inReplyTo,
          references,
          direction: 'inbound',
          ticketId,
          commentId: (comment as { id?: string })?.id,
          subject,
          fromAddress: fromEmail,
        });
      }

      return {
        ok: true,
        action: 'comment',
        ticketNumber,
        ticketId,
        url: this.ticketUrl(ticketNumber),
        threadedBy,
      };
    }

    const title = cleanEmailSubjectTitle(subject);
    const ticket = (await this.tickets.create(actor, {
      title,
      description: `${body}\n\n---\n${sourceNote}`,
      typeCode: 'incident',
      channel: 'email',
      channelMeta: {
        messageId: messageId ?? undefined,
        inReplyTo: inReplyTo ?? undefined,
        from: fromEmail ?? from ?? undefined,
        subject: subject || undefined,
      },
    })) as unknown as { id: string; number: string };

    if (messageId) {
      await this.recordEmailMessage({
        messageId,
        inReplyTo,
        references,
        direction: 'inbound',
        ticketId: ticket.id,
        subject,
        fromAddress: fromEmail,
      });
    }

    return {
      ok: true,
      action: 'create',
      ticketNumber: ticket.number,
      ticketId: ticket.id,
      url: this.ticketUrl(ticket.number),
    };
  }

  async recordEmailMessage(opts: {
    messageId: string;
    inReplyTo?: string | null;
    references?: string[];
    direction: 'inbound' | 'outbound';
    ticketId: string;
    commentId?: string | null;
    subject?: string | null;
    fromAddress?: string | null;
    toAddress?: string | null;
  }) {
    const messageId = normalizeMessageId(opts.messageId);
    if (!messageId) return null;

    try {
      return await this.prisma.emailMessage.upsert({
        where: { messageId },
        create: {
          messageId,
          inReplyTo: opts.inReplyTo ? normalizeMessageId(opts.inReplyTo) : null,
          references: opts.references?.length
            ? opts.references.map((r) => normalizeMessageId(r) ?? r).join(' ')
            : null,
          direction: opts.direction,
          ticketId: opts.ticketId,
          commentId: opts.commentId ?? null,
          subject: opts.subject ?? null,
          fromAddress: opts.fromAddress ?? null,
          toAddress: opts.toAddress ?? null,
        },
        update: {},
      });
    } catch {
      return null;
    }
  }

  /** Latest inbound Message-ID for a ticket (for outbound In-Reply-To). */
  async latestInboundMessageId(ticketNumber: string): Promise<string | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { number: ticketNumber, deletedAt: null },
      select: { id: true },
    });
    if (!ticket) return null;
    const row = await this.prisma.emailMessage.findFirst({
      where: { ticketId: ticket.id, direction: 'inbound' },
      orderBy: { createdAt: 'desc' },
      select: { messageId: true },
    });
    return row?.messageId ?? null;
  }

  async referenceChainForTicket(ticketNumber: string): Promise<string[]> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { number: ticketNumber, deletedAt: null },
      select: { id: true },
    });
    if (!ticket) return [];
    const rows = await this.prisma.emailMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
      select: { messageId: true },
      take: 40,
    });
    return rows.map((r) => r.messageId);
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
