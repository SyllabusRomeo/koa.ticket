import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuthChallengeKind = 'mfa_login' | 'entra_oauth';

@Injectable()
export class AuthChallengeService {
  constructor(private readonly prisma: PrismaService) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async create(params: {
    kind: AuthChallengeKind;
    userId?: string;
    meta?: string;
    ttlMinutes?: number;
  }) {
    const token = this.generateToken();
    const expiresAt = new Date(
      Date.now() + (params.ttlMinutes ?? 10) * 60_000,
    );

    await this.prisma.authChallenge.create({
      data: {
        tokenHash: this.hashToken(token),
        kind: params.kind,
        userId: params.userId,
        meta: params.meta,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async consume(token: string, kind: AuthChallengeKind) {
    const record = await this.prisma.authChallenge.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (
      !record ||
      record.kind !== kind ||
      record.consumedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      return null;
    }

    await this.prisma.authChallenge.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return record;
  }

  async peek(token: string, kind: AuthChallengeKind) {
    const record = await this.prisma.authChallenge.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (
      !record ||
      record.kind !== kind ||
      record.consumedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      return null;
    }

    return record;
  }
}
