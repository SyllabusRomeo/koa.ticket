import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from '../audit/audit.service';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly audit: AuditService,
    private readonly reports: ReportsService,
  ) {}

  @Get('workspace')
  async workspace(@CurrentUser() user: AuthUserView) {
    if (!this.reports.canViewWorkspace(user)) {
      throw new ForbiddenException('Workspace metrics require queue access');
    }
    return this.reports.workspace(user);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.summary({ from, to });
  }

  @Get('export.csv')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: AuthUserView,
    @Req() req: { ip?: string },
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const tickets = await this.reports.loadExportTickets({ from, to });
    await this.audit.log({
      actorId: user.id,
      action: 'report.export',
      entityType: 'tickets',
      after: {
        count: tickets.length,
        format: 'csv',
        from: from ?? null,
        to: to ?? null,
      },
      ipAddress: req.ip,
    });

    const csv = this.reports.buildTicketsCsv(tickets);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="logit-report.csv"',
    );
    res.send(csv);
  }

  @Get('export.pdf')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  async exportPdf(
    @CurrentUser() user: AuthUserView,
    @Req() req: { ip?: string },
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const pdf = await this.reports.buildReportPdf({ from, to });
    await this.audit.log({
      actorId: user.id,
      action: 'report.export',
      entityType: 'tickets',
      after: {
        format: 'pdf',
        bytes: pdf.length,
        from: from ?? null,
        to: to ?? null,
      },
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="logit-report.pdf"',
    );
    res.send(pdf);
  }
}
