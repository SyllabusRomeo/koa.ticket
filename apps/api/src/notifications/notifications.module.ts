import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDigestService } from './notification-digest.service';
import { NotificationDigestPoller } from './notification-digest.poller';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDigestService,
    NotificationDigestPoller,
  ],
  exports: [NotificationsService, NotificationDigestService],
})
export class NotificationsModule {}
