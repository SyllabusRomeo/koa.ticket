import {
  Controller,
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
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

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
