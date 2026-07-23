import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { AuditController } from './audit.controller';
import { AuditExportScheduleRunner } from './audit-export-schedule.runner';
import { AuditService } from './audit.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [AuditController],
  providers: [AuditService, AuditExportScheduleRunner],
  exports: [AuditService],
})
export class AuditModule {}
