import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { JudgementView, Paginated, SimilarCaseView } from '@anura/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SearchService } from './search.service';
import { QueryJudgementsDto } from './dto/query-judgements.dto';
import { SimilarByCaseDto, SimilarByTextDto } from './dto/similar.dto';

/** Search & recommendation over previous judgements (pgvector-backed). */
@Controller('research')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** GET /research/judgements — paginated text search over judgements. */
  @Get('judgements')
  judgements(@Query() query: QueryJudgementsDto): Promise<Paginated<JudgementView>> {
    return this.search.searchJudgements(query);
  }

  /** GET /research/similar?caseId= — judgements similar to one of the caller's cases. */
  @Get('similar')
  similarForCase(
    @Query() query: SimilarByCaseDto,
    @CurrentUser('lawyerId') lawyerId: string | null,
  ): Promise<SimilarCaseView[]> {
    return this.search.similarForCase(query.caseId, lawyerId);
  }

  /** POST /research/similar — judgements similar to arbitrary text. */
  @Post('similar')
  similarForText(@Body() body: SimilarByTextDto): Promise<SimilarCaseView[]> {
    return this.search.similarForText(body.text, body.practiceArea);
  }

  /** POST /research/reindex — embed every judgement missing an embedding. */
  @Post('reindex')
  reindex(): Promise<{ indexed: number }> {
    return this.search.reindex();
  }
}
