import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESSION_COOKIE } from '@logit/shared';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { SsoService } from './sso.service';
import {
  ChangePasswordDto,
  LoginDto,
  MfaCodeDto,
  MfaDisableDto,
  MfaVerifyLoginDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { CurrentUser } from './decorators';
import { SessionAuthGuard } from './guards/session-auth.guard';
import type { AuthUserView } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;

  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly sso: SsoService,
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

    if (result.mfaRequired) {
      return { mfaRequired: true, mfaToken: result.mfaToken };
    }

    res.cookie(
      this.cookieName,
      result.sessionToken,
      this.auth.cookieOptions(result.expiresAt),
    );

    return { user: result.user, mfaRequired: false };
  }

  @Post('mfa/verify-login')
  async verifyMfaLogin(
    @Body() dto: MfaVerifyLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyMfaLogin(dto.mfaToken, dto.code, {
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

  @Post('mfa/setup')
  @UseGuards(SessionAuthGuard)
  setupMfa(@CurrentUser() user: AuthUserView) {
    return this.mfa.beginSetup(user.id);
  }

  @Post('mfa/confirm')
  @UseGuards(SessionAuthGuard)
  confirmMfa(@CurrentUser() user: AuthUserView, @Body() dto: MfaCodeDto) {
    return this.mfa.confirmSetup(user.id, dto.code);
  }

  @Post('mfa/cancel-setup')
  @UseGuards(SessionAuthGuard)
  cancelMfaSetup(@CurrentUser() user: AuthUserView) {
    return this.mfa.cancelSetup(user.id);
  }

  @Post('mfa/disable')
  @UseGuards(SessionAuthGuard)
  disableMfa(@CurrentUser() user: AuthUserView, @Body() dto: MfaDisableDto) {
    return this.mfa.disable(user.id, dto.password, dto.code);
  }

  @Get('sso/providers')
  ssoProviders() {
    return this.sso.providers();
  }

  @Get('sso/entra')
  async entraStart(@Res() res: Response) {
    const { authorizeUrl } = await this.sso.beginEntra();
    return res.redirect(authorizeUrl);
  }

  @Get('sso/entra/callback')
  async entraCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const web = this.sso.webOrigin().replace(/\/$/, '');
    if (error) {
      const msg = encodeURIComponent(
        errorDescription || error || 'SSO failed',
      );
      return res.redirect(`${web}/login?ssoError=${msg}`);
    }
    if (!code || !state) {
      return res.redirect(
        `${web}/login?ssoError=${encodeURIComponent('Missing SSO code')}`,
      );
    }

    try {
      const result = await this.sso.completeEntra(code, state, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.cookie(
        this.cookieName,
        result.sessionToken,
        this.auth.cookieOptions(result.expiresAt),
      );
      return res.redirect(result.redirectTo);
    } catch (err) {
      const msg = encodeURIComponent(
        err instanceof Error ? err.message : 'SSO failed',
      );
      return res.redirect(`${web}/login?ssoError=${msg}`);
    }
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

  @Get('profile')
  @UseGuards(SessionAuthGuard)
  profile(@CurrentUser() user: AuthUserView) {
    return this.auth.profileContext(user.id);
  }

  @Patch('me')
  @UseGuards(SessionAuthGuard)
  async updateMe(
    @CurrentUser() user: AuthUserView,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.auth.updateProfile(user.id, dto);
    return { user: updated };
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
