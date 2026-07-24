import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

class SetAccessDto {
  /** Preferred: single primary role. */
  @IsOptional()
  @IsString()
  roleCode?: string;

  /** Legacy: must be empty or a single code when roleCode is omitted. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  /** Additive extras — unioned with role permissions at session resolve time. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraPermissionCodes?: string[];
}

@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  list() {
    return this.users.list();
  }

  @Get('roles/matrix')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  rolesMatrix() {
    return this.users.rolesMatrix();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  get(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Post(':id/reset-password')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  resetPassword(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.users.resetPassword(id, actor.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUserView) {
    return this.users.softDelete(id, actor.id);
  }

  @Patch(':id/roles')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  setAccess(@Param('id') id: string, @Body() dto: SetAccessDto) {
    return this.users.setAccess(id, dto);
  }
}
