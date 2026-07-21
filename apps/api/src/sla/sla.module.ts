import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
