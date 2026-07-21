import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditListQuery = {
  limit?: number;
  action?: string;
  actor?: string;
  entityType?: string;
  from?: string;
  to?: string;
  q?: string;
};

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

  async list(query: AuditListQuery = {}) {
    const take = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const where: Prisma.AuditLogWhereInput = {};

    if (query.action?.trim()) {
      where.action = {
        contains: query.action.trim(),
        mode: 'insensitive',
      };
    }

    if (query.entityType?.trim()) {
      where.entityType = {
        equals: query.entityType.trim(),
        mode: 'insensitive',
      };
    }

    if (query.actor?.trim()) {
      const actor = query.actor.trim();
      where.actor = {
        OR: [
          { email: { contains: actor, mode: 'insensitive' } },
          { firstName: { contains: actor, mode: 'insensitive' } },
          { lastName: { contains: actor, mode: 'insensitive' } },
        ],
      };
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        const from = new Date(query.from);
        if (!Number.isNaN(from.getTime())) {
          where.createdAt.gte = from;
        }
      }
      if (query.to) {
        const to = new Date(query.to);
        if (!Number.isNaN(to.getTime())) {
          // Inclusive end-of-day when only a date is provided (YYYY-MM-DD)
          if (/^\d{4}-\d{2}-\d{2}$/.test(query.to.trim())) {
            to.setHours(23, 59, 59, 999);
          }
          where.createdAt.lte = to;
        }
      }
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        {
          actor: {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      rows: rows.map((r) => {
        let after: Record<string, unknown> | null = null;
        if (r.afterJson) {
          try {
            after = JSON.parse(r.afterJson) as Record<string, unknown>;
          } catch {
            after = null;
          }
        }
        return {
          id: r.id,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          createdAt: r.createdAt,
          ipAddress: r.ipAddress,
          actor: r.actor,
          after,
        };
      }),
      total,
      limit: take,
    };
  }

  async exportCsv(query: AuditListQuery = {}) {
    const result = await this.list({
      ...query,
      limit: Math.min(Math.max(query.limit ?? 5000, 1), 5000),
    });

    const escape = (value: string | number | null | undefined) => {
      const s = value == null ? '' : String(value);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = [
      'createdAt',
      'action',
      'entityType',
      'entityId',
      'actorEmail',
      'actorName',
      'ipAddress',
    ].join(',');

    const rows = result.rows.map((r) => {
      const actorName = r.actor
        ? `${r.actor.firstName} ${r.actor.lastName}`.trim()
        : '';
      return [
        escape(new Date(r.createdAt).toISOString()),
        escape(r.action),
        escape(r.entityType),
        escape(r.entityId ?? ''),
        escape(r.actor?.email ?? ''),
        escape(actorName),
        escape(r.ipAddress ?? ''),
      ].join(',');
    });

    return {
      csv: `${header}\n${rows.join('\n')}`,
      count: result.rows.length,
      total: result.total,
    };
  }

  /** Distinct action / entityType values for filter dropdowns. */
  async facets() {
    const [actions, entityTypes] = await Promise.all([
      this.prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
        take: 100,
      }),
      this.prisma.auditLog.findMany({
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
        take: 50,
      }),
    ]);
    return {
      actions: actions.map((a) => a.action),
      entityTypes: entityTypes.map((e) => e.entityType),
    };
  }
}
