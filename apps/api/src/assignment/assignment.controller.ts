import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignmentService } from './assignment.service';

class CreateRuleDto {
  @IsString()
  name!: string;

  @IsString()
  teamId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  ticketTypeId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}

@Controller('assignment-rules')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AssignmentController {
  constructor(private readonly assignment: AssignmentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORG_READ)
  list() {
    return this.assignment.listRules();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  create(@Body() dto: CreateRuleDto) {
    return this.assignment.createRule(dto);
  }
}
