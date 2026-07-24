import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthChallengeService } from './auth-challenge.service';
import { MfaService } from './mfa.service';
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
    private readonly challenges: AuthChallengeService,
    private readonly mfa: MfaService,
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

    if (user!.mfaEnabled && user!.mfaSecret) {
      const challenge = await this.challenges.create({
        kind: 'mfa_login',
        userId: user!.id,
        ttlMinutes: 10,
      });
      return {
        mfaRequired: true as const,
        mfaToken: challenge.token,
      };
    }

    const session = await this.sessions.create({
      userId: user!.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      mfaRequired: false as const,
      user: this.toAuthUser(user!),
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    };
  }

  async verifyMfaLogin(
    mfaToken: string,
    code: string,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    // Peek first so a wrong code does not burn the challenge (user can retry).
    const pending = await this.challenges.peek(mfaToken, 'mfa_login');
    if (!pending?.userId) {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: pending.userId, deletedAt: null, isActive: true },
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

    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }

    if (!this.mfa.verifyCode(user.mfaSecret, code, user.email)) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    const challenge = await this.challenges.consume(mfaToken, 'mfa_login');
    if (!challenge?.userId) {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }

    const session = await this.sessions.create({
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user: this.toAuthUser(user),
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

  async getAuthUserById(userId: string): Promise<AuthUserView> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
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
    if (!user) throw new UnauthorizedException('Not authenticated');
    return this.toAuthUser(user);
  }

  async profileContext(userId: string) {
    const [user, locations, departments] = await Promise.all([
      this.getAuthUserById(userId),
      this.prisma.location.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          site: true,
          country: true,
          timezone: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          locationId: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { user, locations, departments };
  }

  async updateProfile(
    userId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      locationId?: string | null;
      departmentId?: string | null;
    },
  ) {
    if (dto.locationId !== undefined && dto.locationId !== null && dto.locationId.trim()) {
      const loc = await this.prisma.location.findFirst({
        where: { id: dto.locationId.trim(), deletedAt: null, isActive: true },
      });
      if (!loc) throw new BadRequestException('Location not found');
    }
    if (
      dto.departmentId !== undefined &&
      dto.departmentId !== null &&
      dto.departmentId.trim()
    ) {
      const dept = await this.prisma.department.findFirst({
        where: {
          id: dto.departmentId.trim(),
          deletedAt: null,
          isActive: true,
        },
      });
      if (!dept) throw new BadRequestException('Department not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        locationId:
          dto.locationId === undefined
            ? undefined
            : dto.locationId === null || !String(dto.locationId).trim()
              ? null
              : String(dto.locationId).trim(),
        departmentId:
          dto.departmentId === undefined
            ? undefined
            : dto.departmentId === null || !String(dto.departmentId).trim()
              ? null
              : String(dto.departmentId).trim(),
      },
    });

    return this.getAuthUserById(userId);
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
