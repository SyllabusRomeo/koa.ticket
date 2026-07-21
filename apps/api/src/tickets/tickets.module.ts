import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaModule } from '../sla/sla.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    AuthModule,
    AssignmentModule,
    AuditModule,
    NotificationsModule,
    SlaModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
