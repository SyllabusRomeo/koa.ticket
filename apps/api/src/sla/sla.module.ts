import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaController } from './sla.controller';
import { SlaPoller } from './sla.poller';
import { SlaService } from './sla.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [SlaController],
  providers: [SlaService, SlaPoller],
  exports: [SlaService],
})
export class SlaModule {}
