import { Controller, Get, Header, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Controller('reports')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  async summary() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      openTickets,
      createdToday,
      resolvedToday,
      slaBreaches,
      byCategory,
      byPriority,
    ] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          deletedAt: null,
          status: { isTerminal: false },
        },
      }),
      this.prisma.ticket.count({
        where: { deletedAt: null, createdAt: { gte: startOfDay } },
      }),
      this.prisma.ticket.count({
        where: { deletedAt: null, resolvedAt: { gte: startOfDay } },
      }),
      this.prisma.slaInstance.count({
        where: { breachedAt: { not: null }, completedAt: null },
      }),
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.ticket.groupBy({
        by: ['priorityId'],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);

    const unassigned = await this.prisma.ticket.count({
      where: {
        deletedAt: null,
        assigneeId: null,
        status: { isTerminal: false },
      },
    });

    return {
      openTickets,
      createdToday,
      resolvedToday,
      slaBreaches,
      unassigned,
      byCategory,
      byPriority,
    };
  }

  @Get('export.csv')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @CurrentUser() user: AuthUserView,
    @Req() req: { ip?: string },
    @Res() res: Response,
  ) {
    const tickets = await this.prisma.ticket.findMany({
      where: { deletedAt: null },
      include: {
        status: true,
        priority: true,
        type: true,
        category: true,
        requester: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    await this.audit.log({
      actorId: user.id,
      action: 'report.export',
      entityType: 'tickets',
      after: { count: tickets.length, format: 'csv' },
      ipAddress: req.ip,
    });

    const header =
      'number,title,type,status,priority,category,requester,createdAt\n';
    const rows = tickets
      .map((t) =>
        [
          t.number,
          `"${t.title.replace(/"/g, '""')}"`,
          t.type.code,
          t.status.code,
          t.priority?.code ?? '',
          t.category?.code ?? '',
          t.requester.email,
          t.createdAt.toISOString(),
        ].join(','),
      )
      .join('\n');

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="logit-tickets.csv"',
    );
    res.send(header + rows);
  }
}
