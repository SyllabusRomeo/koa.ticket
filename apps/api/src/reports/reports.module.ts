import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportScheduleRunner } from './report-schedule.runner';

@Module({
  imports: [AuthModule, AuditModule, EmailModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportScheduleRunner],
  exports: [ReportsService],
})
export class ReportsModule {}
