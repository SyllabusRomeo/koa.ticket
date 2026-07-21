import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

export type AuthUserView = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: string[];
  departmentId: string | null;
  locationId: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  toAuthUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    mustChangePassword: boolean;
    mfaEnabled: boolean;
    departmentId: string | null;
    locationId: string | null;
    roles: Array<{
      role: {
        code: string;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>;
    extraPermissions?: Array<{ permission: { code: string } }>;
  }): AuthUserView {
    const roles = user.roles.map((r) => r.role.code);
    const rolePerms = user.roles.flatMap((r) =>
      r.role.permissions.map((p) => p.permission.code),
    );
    const extras = (user.extraPermissions ?? []).map(
      (p) => p.permission.code,
    );
    /** Effective = primary role permissions ∪ additive extras. */
    const permissions = [...new Set([...rolePerms, ...extras])];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      mustChangePassword: user.mustChangePassword,
      mfaEnabled: user.mfaEnabled,
      roles,
      permissions,
      departmentId: user.departmentId,
      locationId: user.locationId,
    };
  }

  async login(
    email: string,
    password: string,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null },
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

    const fail = async (reason: string) => {
      await this.prisma.loginAttempt.create({
        data: {
          email: normalized,
          ipAddress: meta.ipAddress,
          success: false,
        },
      });
      throw new UnauthorizedException(reason);
    };

    if (!user || !user.isActive) {
      await fail('Invalid email or password');
    }

    if (user!.lockedUntil && user!.lockedUntil.getTime() > Date.now()) {
      await fail('Account temporarily locked. Try again later.');
    }

    const valid = await this.passwords.verify(user!.passwordHash, password);
    if (!valid) {
      const failedLoginCount = user!.failedLoginCount + 1;
      const data: {
        failedLoginCount: number;
        lockedUntil?: Date;
      } = { failedLoginCount };

      if (failedLoginCount >= MAX_FAILED_LOGINS) {
        data.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
        data.failedLoginCount = 0;
      }

      await this.prisma.user.update({ where: { id: user!.id }, data });
      await fail('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user!.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.prisma.loginAttempt.create({
      data: {
        email: normalized,
        ipAddress: meta.ipAddress,
        success: true,
      },
    });

    const session = await this.sessions.create({
      userId: user!.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user: this.toAuthUser(user!),
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    };
  }

  async logout(token?: string) {
    if (token) await this.sessions.revoke(token);
  }

  async me(token: string) {
    const session = await this.sessions.findValidSession(token);
    if (!session) throw new UnauthorizedException('Not authenticated');
    return this.toAuthUser(session.user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const policyError = this.passwords.validatePolicy(newPassword);
    if (policyError) throw new BadRequestException(policyError);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const ok = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    await this.sessions.revokeAllForUser(userId);
  }

  async requestPasswordReset(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null, isActive: true },
    });

    // Always return success to avoid account enumeration.
    if (!user) return { ok: true };

    const raw = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60_000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Phase 6 wires email. Dev: expose token only outside production.
    const expose =
      this.config.get('NODE_ENV') !== 'production' &&
      this.config.get('EXPOSE_RESET_TOKENS') === 'true';

    return expose ? { ok: true, resetToken: raw } : { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const policyError = this.passwords.validatePolicy(newPassword);
    if (policyError) throw new BadRequestException(policyError);

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !record ||
      record.usedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.sessions.revokeAllForUser(record.userId);
    return { ok: true };
  }

  cookieOptions(expiresAt: Date) {
    const secure = this.config.get('COOKIE_SECURE') === 'true';
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/',
      expires: expiresAt,
    };
  }
}
