import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ReportsController } from './reports.controller';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
