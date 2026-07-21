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
    ]);

    const [statuses, priorities, types, teams, assignees] = await Promise.all([
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
    ]);

    const statusMap = new Map(statuses.map((s) => [s.id, s]));
    const priorityMap = new Map(priorities.map((p) => [p.id, p]));
    const typeMap = new Map(types.map((t) => [t.id, t]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const assigneeMap = new Map(assignees.map((u) => [u.id, u]));

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
      generatedAt: now.toISOString(),
    };
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
}
