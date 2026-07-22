import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthChallengeService } from './auth-challenge.service';
import { MfaService } from './mfa.service';
import { SsoService } from './sso.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthChallengeService,
    MfaService,
    SsoService,
    PasswordService,
    SessionService,
    SessionAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    AuthChallengeService,
    MfaService,
    SsoService,
    PasswordService,
    SessionService,
    SessionAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
