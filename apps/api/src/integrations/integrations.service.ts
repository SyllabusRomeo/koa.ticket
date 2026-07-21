import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ROLES } from '@logit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, type AuthUserView } from '../auth/auth.service';
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

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly tickets: TicketsService,
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
}
