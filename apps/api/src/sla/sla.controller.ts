import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SlaService } from './sla.service';

class CreatePolicyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  priorityId?: string;

  @IsInt()
  @Min(1)
  firstResponseMinutes!: number;

  @IsInt()
  @Min(1)
  resolveMinutes!: number;
}

@Controller('sla')
@UseGuards(SessionAuthGuard, RolesGuard)
export class SlaController {
  constructor(
    private readonly sla: SlaService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('policies')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  policies() {
    return this.sla.listPolicies();
  }

  @Post('policies')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreatePolicyDto) {
    return this.prisma.slaPolicy.create({
      data: {
        name: dto.name,
        priorityId: dto.priorityId,
        firstResponseMinutes: dto.firstResponseMinutes,
        resolveMinutes: dto.resolveMinutes,
        escalations: {
          create: [
            { thresholdPercent: 75, notifyRoleCodes: 'agent' },
            { thresholdPercent: 90, notifyRoleCodes: 'agent,it_manager' },
            { thresholdPercent: 100, notifyRoleCodes: 'it_manager,sysadmin' },
          ],
        },
      },
      include: { escalations: true },
    });
  }

  @Get('tickets/:id')
  forTicket(@Param('id') id: string) {
    return this.sla.listForTicket(id);
  }
}
