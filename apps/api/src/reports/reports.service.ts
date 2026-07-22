import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PERMISSIONS } from '@logit/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserView } from '../auth/auth.service';

const HOLD_PENDING = [
  'on_hold',
  'pending_user',
  'pending_vendor',
  'pending_approval',
] as const;

const OPENISH = ['new', 'open', 'assigned', 'in_progress'] as const;

export type ReportDateRange = {
  from?: string;
  to?: string;
};

type NamedCount = { code: string; name: string; count: number };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  canViewWorkspace(user: AuthUserView) {
    return (
      user.permissions.includes(PERMISSIONS.TICKETS_READ_ALL) ||
      user.permissions.includes(PERMISSIONS.TICKETS_READ_QUEUE) ||
      user.permissions.includes(PERMISSIONS.REPORTS_READ)
    );
  }

  parseCreatedAtFilter(range: ReportDateRange = {}): Prisma.DateTimeFilter | undefined {
    const filter: Prisma.DateTimeFilter = {};
    if (range.from?.trim()) {
      const from = new Date(range.from.trim());
      if (!Number.isNaN(from.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(range.from.trim())) {
          from.setHours(0, 0, 0, 0);
        }
        filter.gte = from;
      }
    }
    if (range.to?.trim()) {
      const to = new Date(range.to.trim());
      if (!Number.isNaN(to.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(range.to.trim())) {
          to.setHours(23, 59, 59, 999);
        }
        filter.lte = to;
      }
    }
    return filter.gte || filter.lte ? filter : undefined;
  }

  ticketWhere(range: ReportDateRange = {}): Prisma.TicketWhereInput {
    const createdAt = this.parseCreatedAtFilter(range);
    return {
      deletedAt: null,
      ...(createdAt ? { createdAt } : {}),
    };
  }

  async workspace(user: AuthUserView) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const now = new Date();

    const active = { deletedAt: null, status: { isTerminal: false } };

    const [
      overdueSla,
      dueTodaySla,
      open,
      onHoldPending,
      unassigned,
      assignedToMe,
      byStatusRaw,
      byPriorityRaw,
      recent,
    ] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          ...active,
          OR: [
            { dueAt: { lt: now } },
            {
              slaInstances: {
                some: {
                  completedAt: null,
                  OR: [
                    { breachedAt: { not: null } },
                    { dueAt: { lt: now } },
                  ],
                },
              },
            },
          ],
        },
      }),
      this.prisma.ticket.count({
        where: {
          ...active,
          OR: [
            { dueAt: { gte: startOfDay, lt: endOfDay } },
            {
              slaInstances: {
                some: {
                  completedAt: null,
                  breachedAt: null,
                  dueAt: { gte: startOfDay, lt: endOfDay },
                },
              },
            },
          ],
        },
      }),
      this.prisma.ticket.count({
        where: {
          deletedAt: null,
          status: { code: { in: [...OPENISH] } },
        },
      }),
      this.prisma.ticket.count({
        where: {
          deletedAt: null,
          status: { code: { in: [...HOLD_PENDING] } },
        },
      }),
      this.prisma.ticket.count({
        where: { ...active, assigneeId: null },
      }),
      this.prisma.ticket.count({
        where: { ...active, assigneeId: user.id },
      }),
      this.prisma.ticket.groupBy({
        by: ['statusId'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['priorityId'],
        where: { deletedAt: null, status: { isTerminal: false } },
        _count: { _all: true },
      }),
      this.prisma.ticket.findMany({
        where: active,
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          number: true,
          title: true,
          assigneeId: true,
          dueAt: true,
          status: { select: { code: true, name: true, isTerminal: true } },
          priority: { select: { code: true, name: true } },
          slaInstances: {
            where: { metric: 'resolution' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              dueAt: true,
              pausedAt: true,
              completedAt: true,
              breachedAt: true,
              percentConsumed: true,
            },
          },
        },
      }),
    ]);

    const statuses = await this.prisma.ticketStatus.findMany({
      select: { id: true, code: true, name: true, isTerminal: true },
    });
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    const priorities = await this.prisma.priority.findMany({
      select: { id: true, code: true, name: true, rank: true },
      orderBy: { rank: 'asc' },
    });
    const priorityMap = new Map(priorities.map((p) => [p.id, p]));

    const byStatus = byStatusRaw
      .map((row) => {
        const s = statusMap.get(row.statusId);
        return {
          code: s?.code ?? 'unknown',
          name: s?.name ?? 'Unknown',
          count: row._count._all,
          isTerminal: s?.isTerminal ?? false,
        };
      })
      .sort((a, b) => b.count - a.count);

    const byPriority = [
      ...byPriorityRaw
        .filter((row) => row.priorityId)
        .map((row) => {
          const p = priorityMap.get(row.priorityId!);
          return {
            code: p?.code ?? 'unknown',
            name: p?.name ?? 'Unknown',
            count: row._count._all,
            rank: p?.rank ?? 99,
          };
        }),
      ...(() => {
        const none = byPriorityRaw.find((r) => r.priorityId === null);
        return none
          ? [
              {
                code: 'none',
                name: 'Unprioritized',
                count: none._count._all,
                rank: 100,
              },
            ]
          : [];
      })(),
    ].sort((a, b) => a.rank - b.rank);

    const nowMs = now.getTime();
    const recentWithSla = recent.map((t) => {
      const resolution = t.slaInstances[0] ?? null;
      const dueAt = resolution?.dueAt ?? t.dueAt ?? null;
      const completed =
        Boolean(resolution?.completedAt) || Boolean(t.status.isTerminal);
      const paused = Boolean(resolution?.pausedAt) && !completed;
      let slaRemainingMs: number | null = null;
      let timeToResolution: string | null = null;
      let slaBreached = Boolean(resolution?.breachedAt);

      if (dueAt && !completed) {
        const refMs =
          paused && resolution?.pausedAt
            ? resolution.pausedAt.getTime()
            : nowMs;
        slaRemainingMs = dueAt.getTime() - refMs;
        if (slaRemainingMs < 0) slaBreached = true;
        timeToResolution = this.formatDurationLabel(slaRemainingMs);
      }

      const { slaInstances: _omit, ...rest } = t;
      return {
        ...rest,
        dueAt,
        slaDueAt: dueAt,
        slaRemainingMs,
        slaBreached,
        slaPaused: paused,
        slaCompleted: completed,
        timeToResolution,
      };
    });

    return {
      kpis: {
        overdue: overdueSla,
        dueToday: dueTodaySla,
        open,
        onHoldPending,
        unassigned,
        assignedToMe,
      },
      byPriority,
      byStatus,
      recent: recentWithSla,
      generatedAt: now.toISOString(),
    };
  }

  private formatDurationLabel(ms: number): string {
    const sign = ms < 0 ? '-' : '';
    const abs = Math.abs(ms);
    const totalMinutes = Math.floor(abs / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${sign}${days}d ${hours}h`;
    }
    if (hours >= 1 || totalMinutes >= 60) {
      return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return `${sign}00:${String(minutes).padStart(2, '0')}`;
  }

  async summary(range: ReportDateRange = {}) {
    const where = this.ticketWhere(range);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const now = new Date();

    const createdAtToday: Prisma.TicketWhereInput = {
      deletedAt: null,
      createdAt: { gte: startOfDay },
    };
    const resolvedToday: Prisma.TicketWhereInput = {
      deletedAt: null,
      resolvedAt: { gte: startOfDay },
    };

    const [
      openTickets,
      createdToday,
      resolvedTodayCount,
      slaBreaches,
      unassigned,
      totalInRange,
      byStatusRaw,
      byPriorityRaw,
      byTypeRaw,
      byTeamRaw,
      byAssigneeRaw,
      byLocationRaw,
    ] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          ...where,
          status: { isTerminal: false },
        },
      }),
      this.prisma.ticket.count({ where: createdAtToday }),
      this.prisma.ticket.count({ where: resolvedToday }),
      this.prisma.slaInstance.count({
        where: { breachedAt: { not: null }, completedAt: null },
      }),
      this.prisma.ticket.count({
        where: {
          ...where,
          assigneeId: null,
          status: { isTerminal: false },
        },
      }),
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.groupBy({
        by: ['statusId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['priorityId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['typeId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['teamId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['locationId'],
        where,
        _count: { _all: true },
      }),
    ]);

    const [statuses, priorities, types, teams, assignees, locations] =
      await Promise.all([
      this.prisma.ticketStatus.findMany({
        select: { id: true, code: true, name: true },
      }),
      this.prisma.priority.findMany({
        select: { id: true, code: true, name: true, rank: true },
        orderBy: { rank: 'asc' },
      }),
      this.prisma.ticketType.findMany({
        select: { id: true, code: true, name: true },
      }),
      this.prisma.team.findMany({
        select: { id: true, code: true, name: true },
      }),
      this.prisma.user.findMany({
        where: {
          id: {
            in: byAssigneeRaw
              .map((r) => r.assigneeId)
              .filter((id): id is string => Boolean(id)),
          },
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      this.prisma.location.findMany({
        select: { id: true, code: true, name: true, site: true },
      }),
    ]);

    const statusMap = new Map(statuses.map((s) => [s.id, s]));
    const priorityMap = new Map(priorities.map((p) => [p.id, p]));
    const typeMap = new Map(types.map((t) => [t.id, t]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const assigneeMap = new Map(assignees.map((u) => [u.id, u]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    const byStatus: NamedCount[] = byStatusRaw
      .map((row) => {
        const s = statusMap.get(row.statusId);
        return {
          code: s?.code ?? 'unknown',
          name: s?.name ?? 'Unknown',
          count: row._count._all,
        };
      })
      .sort((a, b) => b.count - a.count);

    const byPriority: NamedCount[] = [
      ...byPriorityRaw
        .filter((r) => r.priorityId)
        .map((row) => {
          const p = priorityMap.get(row.priorityId!);
          return {
            code: p?.code ?? 'unknown',
            name: p?.name ?? 'Unknown',
            count: row._count._all,
            rank: p?.rank ?? 99,
          };
        })
        .sort((a, b) => a.rank - b.rank)
        .map(({ code, name, count }) => ({ code, name, count })),
      ...(() => {
        const none = byPriorityRaw.find((r) => r.priorityId === null);
        return none
          ? [{ code: 'none', name: 'Unprioritized', count: none._count._all }]
          : [];
      })(),
    ];

    const byType: NamedCount[] = byTypeRaw
      .map((row) => {
        const t = typeMap.get(row.typeId);
        return {
          code: t?.code ?? 'unknown',
          name: t?.name ?? 'Unknown',
          count: row._count._all,
        };
      })
      .sort((a, b) => b.count - a.count);

    const byTeam: NamedCount[] = [
      ...byTeamRaw
        .filter((r) => r.teamId)
        .map((row) => {
          const t = teamMap.get(row.teamId!);
          return {
            code: t?.code ?? 'unknown',
            name: t?.name ?? 'Unknown',
            count: row._count._all,
          };
        })
        .sort((a, b) => b.count - a.count),
      ...(() => {
        const none = byTeamRaw.find((r) => r.teamId === null);
        return none
          ? [{ code: 'none', name: 'No team', count: none._count._all }]
          : [];
      })(),
    ];

    const byAssignee: NamedCount[] = [
      ...byAssigneeRaw
        .filter((r) => r.assigneeId)
        .map((row) => {
          const u = assigneeMap.get(row.assigneeId!);
          const name = u
            ? `${u.firstName} ${u.lastName}`.trim() || u.email
            : 'Unknown';
          return {
            code: u?.email ?? row.assigneeId!,
            name,
            count: row._count._all,
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      ...(() => {
        const none = byAssigneeRaw.find((r) => r.assigneeId === null);
        return none
          ? [{ code: 'unassigned', name: 'Unassigned', count: none._count._all }]
          : [];
      })(),
    ];

    const byLocation: NamedCount[] = [
      ...byLocationRaw
        .filter((r) => r.locationId)
        .map((row) => {
          const l = locationMap.get(row.locationId!);
          const label = l
            ? l.site
              ? `${l.name} (${l.site})`
              : l.name
            : 'Unknown';
          return {
            code: l?.code ?? row.locationId!,
            name: label,
            count: row._count._all,
          };
        })
        .sort((a, b) => b.count - a.count),
      ...(() => {
        const none = byLocationRaw.find((r) => r.locationId === null);
        return none
          ? [
              {
                code: 'none',
                name: 'No location',
                count: none._count._all,
              },
            ]
          : [];
      })(),
    ];

    return {
      openTickets,
      createdToday,
      resolvedToday: resolvedTodayCount,
      slaBreaches,
      unassigned,
      totalInRange,
      from: range.from?.trim() || null,
      to: range.to?.trim() || null,
      byStatus,
      byPriority,
      byType,
      byTeam,
      byAssignee,
      byLocation,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Aggregate time-in-status across tickets in range → bottleneck view.
   * Uses TicketHistory status changes (same model as per-ticket stageDurations).
   */
  async stageBottlenecks(range: ReportDateRange = {}) {
    const now = new Date();
    const stuckThresholdMs = 24 * 60 * 60_000;
    const tickets = await this.prisma.ticket.findMany({
      where: this.ticketWhere(range),
      take: 2000,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        title: true,
        createdAt: true,
        status: { select: { code: true, name: true, isTerminal: true } },
        history: {
          where: { field: 'status' },
          orderBy: { createdAt: 'asc' },
          select: {
            oldValue: true,
            newValue: true,
            createdAt: true,
          },
        },
      },
    });

    const statuses = await this.prisma.ticketStatus.findMany({
      select: { code: true, name: true },
    });
    const nameByCode = new Map(statuses.map((s) => [s.code, s.name]));

    type Acc = { totalMs: number; ticketCount: number; currentCount: number };
    const byCode = new Map<string, Acc>();
    const stuck: Array<{
      number: string;
      title: string;
      statusCode: string;
      statusName: string;
      durationMs: number;
      label: string;
    }> = [];

    for (const ticket of tickets) {
      const totals = this.stageTotalsForTicket(ticket, now);
      for (const [code, durationMs] of totals.byStatus) {
        const acc = byCode.get(code) ?? {
          totalMs: 0,
          ticketCount: 0,
          currentCount: 0,
        };
        acc.totalMs += durationMs;
        acc.ticketCount += 1;
        byCode.set(code, acc);
      }
      if (totals.current) {
        const cur = byCode.get(totals.current.statusCode);
        if (cur) cur.currentCount += 1;
        if (
          !ticket.status.isTerminal &&
          totals.current.durationMs >= stuckThresholdMs
        ) {
          stuck.push({
            number: ticket.number,
            title: ticket.title,
            statusCode: totals.current.statusCode,
            statusName:
              nameByCode.get(totals.current.statusCode) ??
              totals.current.statusCode,
            durationMs: totals.current.durationMs,
            label: this.formatDurationLabel(totals.current.durationMs),
          });
        }
      }
    }

    stuck.sort((a, b) => b.durationMs - a.durationMs);

    const grandTotal = [...byCode.values()].reduce((s, a) => s + a.totalMs, 0);
    const byStatus = [...byCode.entries()]
      .map(([code, acc]) => {
        const avgMs =
          acc.ticketCount > 0 ? Math.round(acc.totalMs / acc.ticketCount) : 0;
        return {
          code,
          name: nameByCode.get(code) ?? code,
          ticketCount: acc.ticketCount,
          currentCount: acc.currentCount,
          totalMs: acc.totalMs,
          avgMs,
          avgLabel: this.formatDurationLabel(avgMs),
          totalLabel: this.formatDurationLabel(acc.totalMs),
          pctOfAll:
            grandTotal > 0
              ? Math.round((acc.totalMs / grandTotal) * 1000) / 10
              : 0,
        };
      })
      .sort((a, b) => b.avgMs - a.avgMs);

    return {
      sampleSize: tickets.length,
      stuckThresholdHours: 24,
      from: range.from?.trim() || null,
      to: range.to?.trim() || null,
      byStatus,
      stuckOpen: stuck.slice(0, 15),
      generatedAt: now.toISOString(),
    };
  }

  private stageTotalsForTicket(
    ticket: {
      createdAt: Date;
      status: { code: string };
      history: Array<{
        oldValue: string | null;
        newValue: string | null;
        createdAt: Date;
      }>;
    },
    now: Date,
  ) {
    const statusChanges = ticket.history.filter((h) => h.newValue);
    const byStatus = new Map<string, number>();
    let current: { statusCode: string; durationMs: number } | null = null;

    const add = (code: string, ms: number) => {
      byStatus.set(code, (byStatus.get(code) ?? 0) + Math.max(0, ms));
    };

    if (statusChanges.length === 0) {
      const code = ticket.status.code;
      const durationMs = Math.max(0, now.getTime() - ticket.createdAt.getTime());
      add(code, durationMs);
      current = { statusCode: code, durationMs };
      return { byStatus, current };
    }

    let cursorCode = statusChanges[0].oldValue ?? 'new';
    let cursorAt = ticket.createdAt;
    for (const change of statusChanges) {
      add(cursorCode, change.createdAt.getTime() - cursorAt.getTime());
      cursorCode = change.newValue!;
      cursorAt = change.createdAt;
    }
    const currentMs = Math.max(0, now.getTime() - cursorAt.getTime());
    add(cursorCode, currentMs);
    current = { statusCode: cursorCode, durationMs: currentMs };
    return { byStatus, current };
  }

  async loadExportTickets(range: ReportDateRange = {}, take = 5000) {
    return this.prisma.ticket.findMany({
      where: this.ticketWhere(range),
      include: {
        status: true,
        priority: true,
        type: true,
        requester: {
          select: { email: true, firstName: true, lastName: true },
        },
        assignee: {
          select: { email: true, firstName: true, lastName: true },
        },
        team: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  escapeCsv(value: string | number | null | undefined): string {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  personLabel(
    person?: {
      email: string;
      firstName: string;
      lastName: string;
    } | null,
  ) {
    if (!person) return '';
    const name = `${person.firstName} ${person.lastName}`.trim();
    return name ? `${name} <${person.email}>` : person.email;
  }

  buildTicketsCsv(
    tickets: Awaited<ReturnType<ReportsService['loadExportTickets']>>,
  ) {
    const header = [
      'number',
      'title',
      'status',
      'priority',
      'type',
      'channel',
      'requester',
      'assignee',
      'team',
      'createdAt',
      'resolvedAt',
    ].join(',');

    const rows = tickets.map((t) =>
      [
        this.escapeCsv(t.number),
        this.escapeCsv(t.title),
        this.escapeCsv(t.status.code),
        this.escapeCsv(t.priority?.code ?? ''),
        this.escapeCsv(t.type.code),
        this.escapeCsv(t.channel ?? 'web'),
        this.escapeCsv(this.personLabel(t.requester)),
        this.escapeCsv(this.personLabel(t.assignee)),
        this.escapeCsv(t.team?.name ?? ''),
        this.escapeCsv(t.createdAt.toISOString()),
        this.escapeCsv(t.resolvedAt?.toISOString() ?? ''),
      ].join(','),
    );

    return `${header}\n${rows.join('\n')}`;
  }

  async buildReportPdf(range: ReportDateRange = {}): Promise<Buffer> {
    const [summary, tickets] = await Promise.all([
      this.summary(range),
      this.loadExportTickets(range, 200),
    ]);

    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const rangeLabel =
      summary.from || summary.to
        ? `Created ${summary.from ?? '…'} → ${summary.to ?? '…'}`
        : 'All time (no date filter)';

    doc
      .fontSize(20)
      .fillColor('#0f4a40')
      .text('LogIT Report', { continued: false });
    doc
      .moveDown(0.3)
      .fontSize(10)
      .fillColor('#444')
      .text(`Generated ${new Date(summary.generatedAt).toLocaleString()}`);
    doc.text(rangeLabel);
    doc.moveDown();

    doc.fontSize(13).fillColor('#0f4a40').text('Summary');
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#222');
    const kpiLines = [
      `Open tickets: ${summary.openTickets}`,
      `Created today: ${summary.createdToday}`,
      `Resolved today: ${summary.resolvedToday}`,
      `SLA breaches (active): ${summary.slaBreaches}`,
      `Unassigned (open): ${summary.unassigned}`,
      `Tickets in range: ${summary.totalInRange}`,
    ];
    for (const line of kpiLines) {
      doc.text(line);
    }

    const writeBreakdown = (title: string, rows: NamedCount[]) => {
      doc.moveDown();
      doc.fontSize(12).fillColor('#0f4a40').text(title);
      doc.moveDown(0.25);
      doc.fontSize(9).fillColor('#222');
      if (!rows.length) {
        doc.text('No data');
        return;
      }
      for (const row of rows.slice(0, 15)) {
        doc.text(`${row.name}: ${row.count}`);
      }
    };

      writeBreakdown('By status', summary.byStatus);
    writeBreakdown('By priority', summary.byPriority);
    writeBreakdown('By type', summary.byType);
    writeBreakdown('By team', summary.byTeam);
    writeBreakdown('By location', summary.byLocation ?? []);
    writeBreakdown('By assignee', summary.byAssignee);

    doc.addPage();
    doc.fontSize(13).fillColor('#0f4a40').text('Tickets (sample)');
    doc
      .moveDown(0.3)
      .fontSize(9)
      .fillColor('#666')
      .text(`Showing up to ${tickets.length} most recent in range`);
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#222');

    for (const t of tickets) {
      const line = [
        t.number,
        t.status.code,
        t.priority?.code ?? '-',
        t.type.code,
        t.title.slice(0, 60),
      ].join(' | ');
      doc.text(line, { width: 516 });
      if (doc.y > 720) {
        doc.addPage();
        doc.fontSize(8).fillColor('#222');
      }
    }

    doc.end();
    return done;
  }

  /**
   * Volume heatmap: day-of-week (0=Sun…6=Sat) × hour (0–23)
   * for tickets created or resolved in the date range.
   */
  async heatmap(
    range: ReportDateRange = {},
    metric: 'created' | 'resolved' = 'created',
  ) {
    const dateFilter = this.parseCreatedAtFilter(range);
    const where: Prisma.TicketWhereInput =
      metric === 'created'
        ? {
            deletedAt: null,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          }
        : {
            deletedAt: null,
            resolvedAt: dateFilter ?? { not: null },
          };

    const tickets = await this.prisma.ticket.findMany({
      where,
      select: {
        createdAt: true,
        resolvedAt: true,
      },
      take: 20_000,
      orderBy: { createdAt: 'desc' },
    });

    const cells = new Map<string, number>();
    let max = 0;
    for (const t of tickets) {
      const at = metric === 'resolved' ? t.resolvedAt : t.createdAt;
      if (!at) continue;
      const dayOfWeek = at.getDay();
      const hour = at.getHours();
      const key = `${dayOfWeek}:${hour}`;
      const next = (cells.get(key) ?? 0) + 1;
      cells.set(key, next);
      if (next > max) max = next;
    }

    const matrix: Array<{ dayOfWeek: number; hour: number; count: number }> =
      [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let hour = 0; hour < 24; hour++) {
        const count = cells.get(`${dayOfWeek}:${hour}`) ?? 0;
        if (count > 0) {
          matrix.push({ dayOfWeek, hour, count });
        }
      }
    }

    return {
      metric,
      from: range.from?.trim() || null,
      to: range.to?.trim() || null,
      sampleSize: tickets.length,
      max,
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      cells: matrix,
      generatedAt: new Date().toISOString(),
    };
  }

  canManageSchedules(user: AuthUserView) {
    return (
      user.permissions.includes(PERMISSIONS.REPORTS_READ) ||
      user.permissions.includes(PERMISSIONS.SETTINGS_MANAGE)
    );
  }

  private parseScheduleFilters(raw: unknown): {
    rangeDays: number;
  } {
    const obj =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const n = Number(obj.rangeDays);
    const rangeDays =
      Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 365) : 7;
    return { rangeDays };
  }

  private rangeFromDays(rangeDays: number): ReportDateRange {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - (rangeDays - 1));
    from.setHours(0, 0, 0, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  }

  private serializeSchedule(row: {
    id: string;
    userId: string;
    cadence: string;
    format: string;
    email: string;
    filters: unknown;
    lastRunAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const filters = this.parseScheduleFilters(row.filters);
    return {
      id: row.id,
      userId: row.userId,
      cadence: row.cadence as 'daily' | 'weekly',
      format: row.format as 'csv' | 'pdf',
      email: row.email,
      filters,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listSchedules(userId: string) {
    const rows = await this.prisma.reportSchedule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.serializeSchedule(r));
  }

  async createSchedule(
    userId: string,
    input: {
      cadence: 'daily' | 'weekly';
      format: 'csv' | 'pdf';
      email: string;
      rangeDays?: number;
      isActive?: boolean;
    },
  ) {
    const rangeDays = this.parseScheduleFilters({
      rangeDays: input.rangeDays,
    }).rangeDays;
    const row = await this.prisma.reportSchedule.create({
      data: {
        userId,
        cadence: input.cadence,
        format: input.format,
        email: input.email.trim().toLowerCase(),
        filters: { rangeDays },
        isActive: input.isActive ?? true,
      },
    });
    return this.serializeSchedule(row);
  }

  async updateSchedule(
    userId: string,
    id: string,
    input: {
      cadence?: 'daily' | 'weekly';
      format?: 'csv' | 'pdf';
      email?: string;
      rangeDays?: number;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.reportSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    const prev = this.parseScheduleFilters(existing.filters);
    const rangeDays =
      input.rangeDays != null
        ? this.parseScheduleFilters({ rangeDays: input.rangeDays }).rangeDays
        : prev.rangeDays;

    const row = await this.prisma.reportSchedule.update({
      where: { id },
      data: {
        ...(input.cadence ? { cadence: input.cadence } : {}),
        ...(input.format ? { format: input.format } : {}),
        ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
        filters: { rangeDays },
        ...(input.isActive != null ? { isActive: input.isActive } : {}),
      },
    });
    return this.serializeSchedule(row);
  }

  async deleteSchedule(userId: string, id: string) {
    const existing = await this.prisma.reportSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) return false;
    await this.prisma.reportSchedule.delete({ where: { id } });
    return true;
  }

  async getScheduleForUser(userId: string, id: string) {
    const row = await this.prisma.reportSchedule.findFirst({
      where: { id, userId },
    });
    return row ? this.serializeSchedule(row) : null;
  }

  async getScheduleRow(userId: string, id: string) {
    return this.prisma.reportSchedule.findFirst({
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
    // daily: once per local calendar day
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    return lastRunAt < startOfToday;
  }

  async listDueSchedules(now = new Date()) {
    const rows = await this.prisma.reportSchedule.findMany({
      where: { isActive: true },
    });
    return rows.filter((r) => this.scheduleIsDue(r.cadence, r.lastRunAt, now));
  }

  async markScheduleRan(id: string, at = new Date()) {
    return this.prisma.reportSchedule.update({
      where: { id },
      data: { lastRunAt: at },
    });
  }

  async buildScheduledExport(schedule: {
    format: string;
    filters: unknown;
  }): Promise<{
    range: ReportDateRange;
    filename: string;
    contentType: string;
    body: Buffer | string;
  }> {
    const { rangeDays } = this.parseScheduleFilters(schedule.filters);
    const range = this.rangeFromDays(rangeDays);
    const stamp = new Date().toISOString().slice(0, 10);

    if (schedule.format === 'pdf') {
      const pdf = await this.buildReportPdf(range);
      return {
        range,
        filename: `logit-report-${stamp}.pdf`,
        contentType: 'application/pdf',
        body: pdf,
      };
    }

    const tickets = await this.loadExportTickets(range);
    const csv = this.buildTicketsCsv(tickets);
    return {
      range,
      filename: `logit-report-${stamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: csv,
    };
  }
}
