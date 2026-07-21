import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AddTeamMemberDto,
  CreateDepartmentDto,
  CreateLocationDto,
  CreateTeamDto,
} from './dto/org.dto';
import { OrgService } from './org.service';

@Controller('org')
@UseGuards(SessionAuthGuard, RolesGuard)
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get('locations')
  @RequirePermissions(PERMISSIONS.ORG_READ)
  locations() {
    return this.org.listLocations();
  }

  @Post('locations')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  createLocation(@Body() dto: CreateLocationDto) {
    return this.org.createLocation(dto);
  }

  @Get('departments')
  @RequirePermissions(PERMISSIONS.ORG_READ)
  departments() {
    return this.org.listDepartments();
  }

  @Post('departments')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.org.createDepartment(dto);
  }

  @Get('teams')
  @RequirePermissions(PERMISSIONS.ORG_READ)
  teams() {
    return this.org.listTeams();
  }

  @Post('teams')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  createTeam(@Body() dto: CreateTeamDto) {
    return this.org.createTeam(dto);
  }

  @Post('teams/:id/members')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  addMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.org.addTeamMember(id, dto);
  }
}
