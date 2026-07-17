import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsPurgeService } from './documents-purge.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsPurgeService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
