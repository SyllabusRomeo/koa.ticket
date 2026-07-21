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
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('status')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(ROLES.SYSADMIN)
  status() {
    return this.integrations.status();
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
    });

    return {
      response_type: 'in_channel',
      text: result.confirmation,
    };
  }

  /** Teams / Bot Framework-style inbound message (loose body) */
  @Public()
  @Post('teams/messages')
  async teamsMessages(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
  ) {
    this.integrations.verifyTeamsSecret(authorization);

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
    };

    const result = await this.integrations.createFromChat({
      channel: 'teams',
      text,
      email: from.email,
      displayName: from.name ?? null,
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
