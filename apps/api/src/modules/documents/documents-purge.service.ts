import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentsService } from './documents.service';

/**
 * Permanently deletes archived documents once their 30-day grace window has
 * elapsed. Runs daily; defensive so a storage/DB hiccup never crashes the app.
 */
@Injectable()
export class DocumentsPurgeService {
  private readonly logger = new Logger(DocumentsPurgeService.name);

  constructor(private readonly documents: DocumentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    try {
      await this.documents.purgeExpired();
    } catch (err) {
      this.logger.error(`Document purge sweep failed: ${(err as Error).message}`);
    }
  }
}
