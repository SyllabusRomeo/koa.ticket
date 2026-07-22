import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { NotificationsService } from './notifications.service';
import { NotificationDigestService } from './notification-digest.service';
import { NotificationDigestPoller } from './notification-digest.poller';
import { DIGEST_FREQUENCIES, type DigestFrequency } from './notification-digest.util';

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

class DigestSettingsDto {
  @IsOptional()
  @IsIn([...DIGEST_FREQUENCIES])
  frequency?: DigestFrequency;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(23)
  quietStartHour?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(23)
  quietEndHour?: number | null;
}

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly digests: NotificationDigestService,
    private readonly digestPoller: NotificationDigestPoller,
  ) {}

  @Get('preferences')
  prefs(@CurrentUser() user: AuthUserView) {
    return this.notifications.getPreferences(user.id);
  }

  @Get('digest')
  digestSettings(@CurrentUser() user: AuthUserView) {
    return this.digests.getSettings(user.id);
  }

  @Patch('digest')
  updateDigest(
    @CurrentUser() user: AuthUserView,
    @Body() dto: DigestSettingsDto,
  ) {
    return this.digests.updateSettings(user.id, dto);
  }

  @Get('digest/status')
  digestStatus() {
    return this.digestPoller.status();
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
