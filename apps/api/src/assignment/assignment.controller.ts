import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignmentService } from './assignment.service';

class CreateRuleDto {
  @IsString()
  @MinLength(2)
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
  @IsString()
  skillId?: string;

  @IsOptional()
  @IsBoolean()
  autoAssignAssignee?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}

class CreateSkillDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class SetUserSkillsDto {
  @IsArray()
  @IsString({ each: true })
  skillIds!: string[];
}

@Controller('assignment-rules')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AssignmentController {
  constructor(private readonly assignment: AssignmentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORG_READ)
  listRules() {
    return this.assignment.listRules();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  createRule(@Body() dto: CreateRuleDto) {
    return this.assignment.createRule(dto);
  }
}

@Controller('skills')
@UseGuards(SessionAuthGuard, RolesGuard)
export class SkillsController {
  constructor(private readonly assignment: AssignmentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORG_READ)
  listSkills() {
    return this.assignment.listSkills();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  createSkill(@Body() dto: CreateSkillDto) {
    return this.assignment.createSkill(dto);
  }

  @Get('users/:userId')
  @RequirePermissions(PERMISSIONS.ORG_READ)
  getUserSkills(@Param('userId') userId: string) {
    return this.assignment.getUserSkills(userId);
  }

  @Put('users/:userId')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  setUserSkills(
    @Param('userId') userId: string,
    @Body() dto: SetUserSkillsDto,
  ) {
    return this.assignment.setUserSkills(userId, dto.skillIds ?? []);
  }
}
