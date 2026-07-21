import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESSION_COOKIE } from '@logit/shared';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { CurrentUser } from './decorators';
import { SessionAuthGuard } from './guards/session-auth.guard';
import type { AuthUserView } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get('SESSION_COOKIE') ?? SESSION_COOKIE;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(
      this.cookieName,
      result.sessionToken,
      this.auth.cookieOptions(result.expiresAt),
    );

    return { user: result.user };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  async logout(
    @Req() req: Request & { sessionToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.sessionToken);
    res.clearCookie(this.cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: AuthUserView) {
    return { user };
  }

  @Post('change-password')
  @UseGuards(SessionAuthGuard)
  async changePassword(
    @CurrentUser() user: AuthUserView,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { sessionToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    res.clearCookie(this.cookieName, { path: '/' });
    return { ok: true, message: 'Password changed. Please sign in again.' };
  }

  @Post('password-reset/request')
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  confirmReset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }
}
