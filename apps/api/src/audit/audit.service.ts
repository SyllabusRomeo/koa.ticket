import { createHash } from 'crypto';
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

export type AuditScheduleFilters = {
  rangeDays: number;
  action?: string;
  entityType?: string;
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

  // —— L5 immutable audit export schedules ——————————————————————————————

  parseExportScheduleFilters(raw: unknown): AuditScheduleFilters {
    const obj =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    let rangeDays = Number(obj.rangeDays ?? 7);
    if (!Number.isFinite(rangeDays) || rangeDays < 1) rangeDays = 7;
    rangeDays = Math.min(Math.floor(rangeDays), 365);
    const action =
      typeof obj.action === 'string' && obj.action.trim()
        ? obj.action.trim()
        : undefined;
    const entityType =
      typeof obj.entityType === 'string' && obj.entityType.trim()
        ? obj.entityType.trim()
        : undefined;
    return { rangeDays, action, entityType };
  }

  private rangeFromDays(rangeDays: number): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  private serializeSchedule(row: {
    id: string;
    userId: string;
    cadence: string;
    email: string;
    filters: unknown;
    lastRunAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const filters = this.parseExportScheduleFilters(row.filters);
    return {
      id: row.id,
      userId: row.userId,
      cadence: row.cadence as 'daily' | 'weekly',
      email: row.email,
      filters,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listExportSchedules(userId: string) {
    const rows = await this.prisma.auditExportSchedule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.serializeSchedule(r));
  }

  async createExportSchedule(
    userId: string,
    input: {
      cadence: 'daily' | 'weekly';
      email: string;
      rangeDays?: number;
      action?: string;
      entityType?: string;
      isActive?: boolean;
    },
  ) {
    const filters = this.parseExportScheduleFilters({
      rangeDays: input.rangeDays,
      action: input.action,
      entityType: input.entityType,
    });
    const row = await this.prisma.auditExportSchedule.create({
      data: {
        userId,
        cadence: input.cadence,
        email: input.email.trim().toLowerCase(),
        filters,
        isActive: input.isActive ?? true,
      },
    });
    return this.serializeSchedule(row);
  }

  async updateExportSchedule(
    userId: string,
    id: string,
    input: {
      cadence?: 'daily' | 'weekly';
      email?: string;
      rangeDays?: number;
      action?: string | null;
      entityType?: string | null;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.auditExportSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    const prev = this.parseExportScheduleFilters(existing.filters);
    const filters = this.parseExportScheduleFilters({
      rangeDays: input.rangeDays ?? prev.rangeDays,
      action:
        input.action === null
          ? undefined
          : (input.action ?? prev.action),
      entityType:
        input.entityType === null
          ? undefined
          : (input.entityType ?? prev.entityType),
    });

    const row = await this.prisma.auditExportSchedule.update({
      where: { id },
      data: {
        ...(input.cadence ? { cadence: input.cadence } : {}),
        ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
        filters,
        ...(input.isActive != null ? { isActive: input.isActive } : {}),
      },
    });
    return this.serializeSchedule(row);
  }

  async deleteExportSchedule(userId: string, id: string) {
    const existing = await this.prisma.auditExportSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) return false;
    await this.prisma.auditExportSchedule.delete({ where: { id } });
    return true;
  }

  async getExportScheduleRow(userId: string, id: string) {
    return this.prisma.auditExportSchedule.findFirst({
      where: { id, userId },
    });
  }

  scheduleIsDue(
    cadence: string,
    lastRunAt: Date | null,
    now = new Date(),
  ): boolean {
    if (!lastRunAt) return true;
    const ms = now.getTime() - lastRunAt.getTime();
    if (cadence === 'weekly') {
      return ms >= 7 * 24 * 60 * 60_000;
    }
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    return lastRunAt < startOfToday;
  }

  async listDueExportSchedules(now = new Date()) {
    const rows = await this.prisma.auditExportSchedule.findMany({
      where: { isActive: true },
    });
    return rows.filter((r) => this.scheduleIsDue(r.cadence, r.lastRunAt, now));
  }

  async markExportScheduleRan(id: string, at = new Date()) {
    return this.prisma.auditExportSchedule.update({
      where: { id },
      data: { lastRunAt: at },
    });
  }

  async buildScheduledAuditExport(schedule: {
    id: string;
    userId: string;
    filters: unknown;
  }): Promise<{
    filename: string;
    contentType: string;
    body: string;
    contentSha256: string;
    rowCount: number;
    range: { from: string; to: string };
    filters: AuditScheduleFilters;
    runId: string;
  }> {
    const filters = this.parseExportScheduleFilters(schedule.filters);
    const range = this.rangeFromDays(filters.rangeDays);
    const exported = await this.exportCsv({
      limit: 5000,
      from: range.from,
      to: range.to,
      action: filters.action,
      entityType: filters.entityType,
    });
    const contentSha256 = createHash('sha256')
      .update(exported.csv, 'utf8')
      .digest('hex');
    const stamp = new Date().toISOString().slice(0, 10);
    const run = await this.prisma.auditExportRun.create({
      data: {
        scheduleId: schedule.id,
        userId: schedule.userId,
        rowCount: exported.count,
        contentSha256,
        rangeFrom: new Date(range.from),
        rangeTo: new Date(range.to),
        filters,
      },
    });
    return {
      filename: `logit-audit-${stamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: exported.csv,
      contentSha256,
      rowCount: exported.count,
      range,
      filters,
      runId: run.id,
    };
  }

  async listExportRuns(userId: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.auditExportRun.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      scheduleId: r.scheduleId,
      rowCount: r.rowCount,
      contentSha256: r.contentSha256,
      rangeFrom: r.rangeFrom?.toISOString() ?? null,
      rangeTo: r.rangeTo?.toISOString() ?? null,
      filters: this.parseExportScheduleFilters(r.filters),
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
