import { Module } from '@nestjs/common';

import { WhatsAppController } from './whatsapp.controller';
import { ReminderService } from './reminder.service';

/**
 * WhatsApp integration module: Meta webhook verification/ingestion plus hearing
 * reminders (manual test endpoint + hourly cron sweep). PrismaService and the
 * WhatsAppService integration are provided by global modules, so only the local
 * ReminderService needs to be registered here.
 */
@Module({
  controllers: [WhatsAppController],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class WhatsAppModule {}
