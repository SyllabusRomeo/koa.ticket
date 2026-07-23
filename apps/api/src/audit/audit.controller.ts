import {
  Body,
  Controller,
  Delete,
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
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditExportScheduleRunner } from './audit-export-schedule.runner';
import { AuditService } from './audit.service';

class CreateAuditExportScheduleDto {
  @IsIn(['daily', 'weekly'])
  cadence!: 'daily' | 'weekly';

  @IsEmail()
  email!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  rangeDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateAuditExportScheduleDto {
  @IsOptional()
  @IsIn(['daily', 'weekly'])
  cadence?: 'daily' | 'weekly';

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
  @IsString()
  @MaxLength(120)
  action?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityType?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('audit')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly scheduleRunner: AuditExportScheduleRunner,
  ) {}

  @Get('facets')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  facets() {
    return this.audit.facets();
  }

  @Get('export.csv')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: AuthUserView,
    @Req() req: { ip?: string },
    @Res() res: Response,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    const exported = await this.audit.exportCsv({
      limit: limit ? Number(limit) : 5000,
      action,
      actor,
      entityType,
      from,
      to,
      q,
    });

    await this.audit.log({
      actorId: user.id,
      action: 'audit.export',
      entityType: 'audit',
      after: {
        count: exported.count,
        total: exported.total,
        format: 'csv',
        filters: { action, actor, entityType, from, to, q },
      },
      ipAddress: req.ip,
    });

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="logit-audit.csv"',
    );
    res.send(exported.csv);
  }

  @Get('export-schedules')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  listSchedules(@CurrentUser() user: AuthUserView) {
    return this.audit.listExportSchedules(user.id);
  }

  @Post('export-schedules')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  async createSchedule(
    @CurrentUser() user: AuthUserView,
    @Body() dto: CreateAuditExportScheduleDto,
  ) {
    const created = await this.audit.createExportSchedule(user.id, dto);
    await this.audit.log({
      actorId: user.id,
      action: 'audit.schedule.create',
      entityType: 'audit_export_schedule',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  @Patch('export-schedules/:id')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  async updateSchedule(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: UpdateAuditExportScheduleDto,
  ) {
    const updated = await this.audit.updateExportSchedule(user.id, id, dto);
    if (!updated) throw new NotFoundException('Schedule not found');
    await this.audit.log({
      actorId: user.id,
      action: 'audit.schedule.update',
      entityType: 'audit_export_schedule',
      entityId: id,
      after: updated,
    });
    return updated;
  }

  @Delete('export-schedules/:id')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  async deleteSchedule(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
  ) {
    const ok = await this.audit.deleteExportSchedule(user.id, id);
    if (!ok) throw new NotFoundException('Schedule not found');
    await this.audit.log({
      actorId: user.id,
      action: 'audit.schedule.delete',
      entityType: 'audit_export_schedule',
      entityId: id,
    });
    return { ok: true };
  }

  @Post('export-schedules/:id/run')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  async runSchedule(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
  ) {
    const result = await this.scheduleRunner.runOne(user.id, id);
    if (result == null) throw new NotFoundException('Schedule not found');
    return { ok: true, result };
  }

  @Get('export-runs')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  listRuns(
    @CurrentUser() user: AuthUserView,
    @Query('limit') limit?: string,
  ) {
    return this.audit.listExportRuns(
      user.id,
      limit ? Number(limit) : 20,
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  list(
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.audit.list({
      limit: limit ? Number(limit) : 100,
      action,
      actor,
      entityType,
      from,
      to,
      q,
    });
  }
}
