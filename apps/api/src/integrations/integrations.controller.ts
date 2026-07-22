import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ROLES } from '@logit/shared';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IntegrationsService } from './integrations.service';
import { ImapPollerService } from './imap-poller.service';

class SimulateDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly imap: ImapPollerService,
  ) {}

  @Get('status')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(ROLES.SYSADMIN)
  status() {
    const base = this.integrations.status();
    return {
      ...base,
      email: {
        ...base.email,
        imap: this.imap.status(),
      },
    };
  }

  @Post('email/imap/poll')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(ROLES.SYSADMIN)
  async imapPoll(@CurrentUser() user: AuthUserView) {
    this.integrations.assertSysadmin(user);
    return this.imap.pollOnce();
  }

  @Post('chat/simulate')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(ROLES.SYSADMIN)
  simulate(@CurrentUser() user: AuthUserView, @Body() dto: SimulateDto) {
    this.integrations.assertSysadmin(user);
    return this.integrations.createFromChat({
      channel: 'simulate',
      text: dto.text,
      email: dto.email ?? user.email,
      displayName: dto.displayName ?? `${user.firstName} ${user.lastName}`,
    });
  }

  /** Slack Events API (url_verification + message mentions) */
  @Public()
  @Post('slack/events')
  async slackEvents(
    @Req()
    req: {
      rawBody?: Buffer;
      body: Record<string, unknown>;
    },
    @Headers('x-slack-signature') signature?: string,
    @Headers('x-slack-request-timestamp') timestamp?: string,
  ) {
    this.integrations.verifySlackSignature(
      req.rawBody,
      timestamp,
      signature,
    );

    const body = req.body ?? {};
    if (body.type === 'url_verification') {
      return { challenge: body.challenge };
    }

    const event = body.event as
      | {
          type?: string;
          bot_id?: string;
          text?: string;
          user?: string;
          channel?: string;
          ts?: string;
          thread_ts?: string;
        }
      | undefined;

    if (!event || event.bot_id) {
      return { ok: true };
    }

    if (event.type === 'app_mention' || event.type === 'message') {
      const text = (event.text ?? '').trim();
      if (!text) return { ok: true };
      const result = await this.integrations.createFromChat({
        channel: 'slack',
        text,
        displayName: event.user ? `slack:${event.user}` : null,
        channelMeta: {
          slackUserId: event.user ?? undefined,
          slackChannelId: event.channel ?? undefined,
          slackTs: event.ts ?? undefined,
          slackThreadTs: event.thread_ts ?? undefined,
        },
      });
      return {
        ok: true,
        ticketNumber: result.ticketNumber,
        url: result.url,
        text: result.confirmation,
      };
    }

    return { ok: true };
  }

  /** Slack slash command `/logit …` (application/x-www-form-urlencoded) */
  @Public()
  @Post('slack/commands')
  async slackCommands(
    @Req()
    req: {
      rawBody?: Buffer;
      body: Record<string, string>;
    },
    @Headers('x-slack-signature') signature?: string,
    @Headers('x-slack-request-timestamp') timestamp?: string,
  ) {
    this.integrations.verifySlackSignature(
      req.rawBody,
      timestamp,
      signature,
    );

    const text = (req.body?.text ?? '').trim();
    if (!text) {
      return {
        response_type: 'ephemeral',
        text: 'Usage: /logit <title> [priority:high|p1|medium|low]',
      };
    }

    const result = await this.integrations.createFromChat({
      channel: 'slack',
      text,
      displayName: req.body?.user_name
        ? `slack:${req.body.user_name}`
        : req.body?.user_id
          ? `slack:${req.body.user_id}`
          : null,
      channelMeta: {
        slackUserId: req.body?.user_id ?? undefined,
        slackUserName: req.body?.user_name ?? undefined,
        slackChannelId: req.body?.channel_id ?? undefined,
        slackTeamId: req.body?.team_id ?? undefined,
        command: req.body?.command ?? undefined,
      },
    });

    return {
      response_type: 'in_channel',
      text: result.confirmation,
    };
  }

  /** Teams / Bot Framework inbound activity (JWT or shared webhook secret) */
  @Public()
  @Post('teams/messages')
  async teamsMessages(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
  ) {
    await this.integrations.verifyTeamsAuth(authorization, {
      serviceUrl: body?.serviceUrl,
    });

    const type = typeof body.type === 'string' ? body.type : '';
    if (type === 'conversationUpdate' || type === 'invoke') {
      return { ok: true };
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return {
        type: 'message',
        text: 'Send a message like: create: VPN down priority:high',
      };
    }

    const from = (body.from ?? {}) as {
      name?: string;
      email?: string;
      id?: string;
    };
    const conversation = (body.conversation ?? {}) as {
      id?: string;
    };

    const result = await this.integrations.createFromChat({
      channel: 'teams',
      text,
      email: from.email,
      displayName: from.name ?? null,
      channelMeta: {
        teamsUserId: from.id ?? undefined,
        conversationId: conversation.id ?? undefined,
        activityId:
          typeof body.id === 'string' ? body.id : undefined,
        serviceUrl:
          typeof body.serviceUrl === 'string' ? body.serviceUrl : undefined,
      },
    });

    return {
      type: 'message',
      text: result.confirmation,
      ticketNumber: result.ticketNumber,
      url: result.url,
    };
  }

  /**
   * Inbound email webhook (SendGrid Inbound Parse / Mailgun Routes style).
   * Accepts JSON or form-urlencoded: from, subject, text|html.
   */
  @Public()
  @Post('email/inbound')
  async emailInbound(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
  ) {
    this.integrations.verifyEmailInboundSecret(authorization);
    return this.integrations.handleInboundEmail(body ?? {});
  }
}
