import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionService {
  private readonly ttlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlDays = Number(config.get('SESSION_TTL_DAYS') ?? 7);
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async create(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.ttlDays);

    await this.prisma.session.create({
      data: {
        tokenHash: this.hashToken(token),
        userId: params.userId,
        expiresAt,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent?.slice(0, 512),
      },
    });

    return { token, expiresAt };
  }

  async findValidSession(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt) return null;
    if (session.expiresAt.getTime() < Date.now()) return null;
    if (!session.user.isActive || session.user.deletedAt) return null;

    return session;
  }

  async revoke(token: string) {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
