import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AutomationModule } from '../automation/automation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PresenceModule } from '../presence/presence.module';
import { SlaModule } from '../sla/sla.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    AuthModule,
    AssignmentModule,
    AuditModule,
    AutomationModule,
    NotificationsModule,
    SlaModule,
    ApprovalsModule,
    PresenceModule,
    WebhooksModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
