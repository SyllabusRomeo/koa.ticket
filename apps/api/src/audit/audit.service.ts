import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ipAddress?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        beforeJson: params.before ? JSON.stringify(params.before) : undefined,
        afterJson: params.after ? JSON.stringify(params.after) : undefined,
        ipAddress: params.ipAddress ?? undefined,
      },
    });
  }

  async list(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }
}
