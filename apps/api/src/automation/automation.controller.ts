import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AutomationService,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from './automation.service';

@Controller('automation/rules')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  list(@CurrentUser() user: AuthUserView) {
    return this.automation.list(user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(
    @CurrentUser() user: AuthUserView,
    @Body() dto: CreateAutomationRuleDto,
  ) {
    return this.automation.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    return this.automation.update(user, id, dto);
  }
}
