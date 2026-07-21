import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  list(@Query('limit') limit?: string) {
    return this.audit.list(limit ? Number(limit) : 100);
  }
}
