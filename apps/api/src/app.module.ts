import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { HealthController } from './health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// Infrastructure
import { PrismaModule } from './prisma/prisma.module';

// Integrations (global)
import { AiModule } from './integrations/ai/ai.module';
import { StorageModule } from './integrations/storage/storage.module';
import { OcrModule } from './integrations/ocr/ocr.module';
import { MessagingModule } from './integrations/messaging/messaging.module';
import { PaymentsModule } from './integrations/payments/payments.module';
import { PushModule } from './integrations/push/push.module';
import { QueueModule } from './integrations/queue/queue.module';
import { EcourtsModule } from './integrations/ecourts/ecourts.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CasesModule } from './modules/cases/cases.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AiAssistantModule } from './modules/ai/ai-assistant.module';
import { SearchModule } from './modules/search/search.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    PrismaModule,

    AiModule,
    StorageModule,
    OcrModule,
    MessagingModule,
    PaymentsModule,
    PushModule,
    QueueModule,
    EcourtsModule,

    AuthModule,
    UsersModule,
    CasesModule,
    DocumentsModule,
    AiAssistantModule,
    SearchModule,
    BillingModule,
    NotificationsModule,
    WhatsAppModule,
    AuditModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
