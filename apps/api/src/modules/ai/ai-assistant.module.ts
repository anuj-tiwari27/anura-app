import { Module } from '@nestjs/common';

import { AiController } from './ai.controller';
import { AiAssistantService } from './ai-assistant.service';

/**
 * AI Assistant feature module: legal chat + document drafting.
 * PrismaService and the integration AiService are provided by @Global modules.
 */
@Module({
  controllers: [AiController],
  providers: [AiAssistantService],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
