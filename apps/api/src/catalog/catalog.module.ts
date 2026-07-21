import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketsModule } from '../tickets/tickets.module';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [AuthModule, TicketsModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
