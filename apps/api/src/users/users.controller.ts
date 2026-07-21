import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsString } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

class SetRolesDto {
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
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

  @Patch(':id/roles')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  setRoles(@Param('id') id: string, @Body() dto: SetRolesDto) {
    return this.users.setRoles(id, dto.roleCodes);
  }
}
