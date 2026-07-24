import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from '../audit/audit.service';
import { ReportsService } from './reports.service';
import { ReportScheduleRunner } from './report-schedule.runner';

class CreateScheduleDto {
  @IsIn(['daily', 'weekly'])
  cadence!: 'daily' | 'weekly';

  @IsIn(['csv', 'pdf'])
  format!: 'csv' | 'pdf';

  @IsEmail()
  email!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  rangeDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateScheduleDto {
  @IsOptional()
  @IsIn(['daily', 'weekly'])
  cadence?: 'daily' | 'weekly';

  @IsOptional()
  @IsIn(['csv', 'pdf'])
  format?: 'csv' | 'pdf';

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  rangeDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('reports')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly audit: AuditService,
    private readonly reports: ReportsService,
    private readonly scheduleRunner: ReportScheduleRunner,
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

  @Get('ims-kpis')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  imsKpis(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.imsKpis({ from, to });
  }

  @Get('stages')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  stages(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.stageBottlenecks({ from, to });
  }

  @Get('heatmap')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  heatmap(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('metric') metric?: string,
  ) {
    const m = metric === 'resolved' ? 'resolved' : 'created';
    return this.reports.heatmap({ from, to }, m);
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

  @Get('schedules')
  async listSchedules(@CurrentUser() user: AuthUserView) {
    this.assertCanManageSchedules(user);
    return this.reports.listSchedules(user.id);
  }

  @Post('schedules')
  async createSchedule(
    @CurrentUser() user: AuthUserView,
    @Body() dto: CreateScheduleDto,
  ) {
    this.assertCanManageSchedules(user);
    const created = await this.reports.createSchedule(user.id, dto);
    await this.audit.log({
      actorId: user.id,
      action: 'report.schedule.create',
      entityType: 'report_schedule',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  @Patch('schedules/:id')
  async updateSchedule(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    this.assertCanManageSchedules(user);
    const updated = await this.reports.updateSchedule(user.id, id, dto);
    if (!updated) throw new NotFoundException('Schedule not found');
    await this.audit.log({
      actorId: user.id,
      action: 'report.schedule.update',
      entityType: 'report_schedule',
      entityId: id,
      after: updated,
    });
    return updated;
  }

  @Delete('schedules/:id')
  async deleteSchedule(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
  ) {
    this.assertCanManageSchedules(user);
    const ok = await this.reports.deleteSchedule(user.id, id);
    if (!ok) throw new NotFoundException('Schedule not found');
    await this.audit.log({
      actorId: user.id,
      action: 'report.schedule.delete',
      entityType: 'report_schedule',
      entityId: id,
    });
    return { ok: true };
  }

  @Post('schedules/:id/run')
  async runSchedule(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
  ) {
    this.assertCanManageSchedules(user);
    const result = await this.scheduleRunner.runOne(user.id, id);
    if (result == null) throw new NotFoundException('Schedule not found');
    return { ok: true, result };
  }

  private assertCanManageSchedules(user: AuthUserView) {
    if (!this.reports.canManageSchedules(user)) {
      throw new ForbiddenException(
        'Scheduled exports require reports:read or settings:manage',
      );
    }
  }
}
