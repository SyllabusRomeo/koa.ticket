import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApprovalsModule } from './approvals/approvals.module';
import { AssignmentModule } from './assignment/assignment.module';
import { AssetsModule } from './assets/assets.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BrandingModule } from './branding/branding.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrgModule } from './org/org.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SlaModule } from './sla/sla.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrgModule,
    TicketsModule,
    AuditModule,
    AttachmentsModule,
    NotificationsModule,
    SlaModule,
    AssignmentModule,
    KnowledgeModule,
    CatalogModule,
    AssetsModule,
    ReportsModule,
    ApprovalsModule,
    IntegrationsModule,
    BrandingModule,
  ],
})
export class AppModule {}
