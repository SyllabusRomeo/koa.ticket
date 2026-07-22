import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { NotificationsService } from './notifications.service';

class PrefDto {
  @IsString()
  eventType!: string;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;
}

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('preferences')
  prefs(@CurrentUser() user: AuthUserView) {
    return this.notifications.getPreferences(user.id);
  }

  @Get('events')
  events() {
    return this.notifications.eventCatalog();
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUserView) {
    const count = await this.notifications.unreadCount(user.id);
    return { count };
  }

  @Patch('preferences')
  upsertPref(@CurrentUser() user: AuthUserView, @Body() dto: PrefDto) {
    return this.notifications.upsertPreference(user.id, dto.eventType, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUserView) {
    return this.notifications.listForUser(user.id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUserView) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
