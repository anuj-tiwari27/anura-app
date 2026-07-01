import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * Search & Recommendation (previous judgements).
 * Text search + pgvector similarity over the Judgement table.
 * PrismaService and AiService are provided by global modules in AppModule.
 */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
