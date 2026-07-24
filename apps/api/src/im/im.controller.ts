import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AddImUpdateDto,
  AssignImRoleDto,
  CreateImIncidentDto,
  ImService,
} from './im.service';

@Controller('im')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ImController {
  constructor(private readonly im: ImService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.IM_READ)
  list(@CurrentUser() user: AuthUserView) {
    return this.im.list(user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.IM_WRITE)
  create(
    @CurrentUser() user: AuthUserView,
    @Body() dto: CreateImIncidentDto,
  ) {
    return this.im.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.IM_READ)
  get(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.im.get(user, id);
  }

  @Post(':id/updates')
  @RequirePermissions(PERMISSIONS.IM_WRITE)
  addUpdate(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: AddImUpdateDto,
  ) {
    return this.im.addUpdate(user, id, dto);
  }

  @Post(':id/roles')
  @RequirePermissions(PERMISSIONS.IM_WRITE)
  assignRole(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: AssignImRoleDto,
  ) {
    return this.im.assignRole(user, id, dto);
  }
}
