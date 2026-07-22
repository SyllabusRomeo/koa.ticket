import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';

@Injectable()
export class MfaService {
  private readonly issuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    config: ConfigService,
  ) {
    this.issuer = config.get('APP_NAME') ?? 'LogIT';
  }

  private buildTotp(secret: string, label: string) {
    return new OTPAuth.TOTP({
      issuer: this.issuer,
      label,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
  }

  verifyCode(secret: string, code: string, label = 'user'): boolean {
    const cleaned = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) return false;
    const delta = this.buildTotp(secret, label).validate({
      token: cleaned,
      window: 1,
    });
    return delta !== null;
  }

  async beginSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const secret = new OTPAuth.Secret({ size: 20 });
    const base32 = secret.base32;
    const totp = this.buildTotp(base32, user.email);
    const otpauthUrl = totp.toString();

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: base32, mfaEnabled: false },
    });

    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    });

    return {
      secret: base32,
      otpauthUrl,
      qrDataUrl,
    };
  }

  async confirmSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }
    if (!user.mfaSecret) {
      throw new BadRequestException('Start MFA setup first');
    }
    if (!this.verifyCode(user.mfaSecret, code, user.email)) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { ok: true, mfaEnabled: true };
  }

  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    if (!this.verifyCode(user.mfaSecret, code, user.email)) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    return { ok: true, mfaEnabled: false };
  }

  async cancelSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is enabled; disable it instead');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: null },
    });
    return { ok: true };
  }
}
