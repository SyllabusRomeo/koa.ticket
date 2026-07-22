import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { TicketsModule } from '../tickets/tickets.module';
import { ImapPollerService } from './imap-poller.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [AuthModule, TicketsModule, EmailModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ImapPollerService],
  exports: [IntegrationsService, ImapPollerService],
})
export class IntegrationsModule {}
