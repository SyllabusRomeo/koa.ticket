import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SessionAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    SessionService,
    SessionAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
