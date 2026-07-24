import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ImController } from './im.controller';
import { ImService } from './im.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ImController],
  providers: [ImService],
  exports: [ImService],
})
export class ImModule {}
