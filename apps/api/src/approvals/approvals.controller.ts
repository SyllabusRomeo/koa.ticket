import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApprovalsService } from './approvals.service';

class DecideDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

@Controller('approvals')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.APPROVALS_READ)
  list(
    @CurrentUser() user: AuthUserView,
    @Query('status') status?: string,
  ) {
    return this.approvals.listMine(user, status);
  }

  @Post(':id/decide')
  @RequirePermissions(PERMISSIONS.APPROVALS_DECIDE)
  decide(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: DecideDto,
  ) {
    return this.approvals.decide(user, id, dto.decision, dto.comment);
  }
}
