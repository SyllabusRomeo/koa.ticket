import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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

class StepDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  approverRoleCode!: string;

  @IsOptional()
  @IsIn(['any', 'all'])
  mode?: 'any' | 'all';

  @IsOptional()
  @IsInt()
  @Min(1)
  stepOrder?: number;
}

class CreatePolicyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  ticketTypeId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  changeRisk?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps!: StepDto[];
}

class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  ticketTypeId?: string | null;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  changeRisk?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps?: StepDto[];
}

@Controller('approvals')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get('policies')
  listPolicies(
    @CurrentUser() user: AuthUserView,
    @Query('includeInactive') includeInactive?: string,
  ) {
    this.approvals.assertCanManagePolicies(user);
    return this.approvals.listPolicies(
      includeInactive === '1' || includeInactive === 'true',
    );
  }

  @Post('policies')
  createPolicy(
    @CurrentUser() user: AuthUserView,
    @Body() dto: CreatePolicyDto,
  ) {
    this.approvals.assertCanManagePolicies(user);
    return this.approvals.createPolicy(dto);
  }

  @Patch('policies/:id')
  updatePolicy(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    this.approvals.assertCanManagePolicies(user);
    return this.approvals.updatePolicy(id, dto);
  }

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
