import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  list() {
    return this.users.list();
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
}
