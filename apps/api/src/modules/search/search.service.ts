import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JudgementView, Paginated, PracticeArea, SimilarCaseView } from '@anura/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../integrations/ai/ai.service';
import { paginated, skipTake } from '../../common/dto/pagination.dto';
import { QueryJudgementsDto } from './dto/query-judgements.dto';

/** How many judgements a vector similarity search returns by default. */
const SIMILAR_LIMIT = 20;

/** Raw shape returned by the pgvector similarity query. */
interface JudgementRow {
  id: string;
  title: string;
  court: string | null;
  citation: string | null;
  practiceArea: PracticeArea | null;
  decidedAt: Date | null;
  summary: string | null;
  url: string | null;
  score?: number | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  // --------------------------------------------------------------------------
  // Text search over judgements (paginated)
  // --------------------------------------------------------------------------

  async searchJudgements(query: QueryJudgementsDto): Promise<Paginated<JudgementView>> {
    const { page = 1, pageSize = 20, search, practiceArea, court } = query;

    const where: Prisma.JudgementWhereInput = {};
    if (practiceArea) {
      where.practiceArea = practiceArea;
    }
    if (court) {
      where.court = { contains: court, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { citation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const { skip, take } = skipTake(page, pageSize);
    const [rows, total] = await Promise.all([
      this.prisma.judgement.findMany({
        where,
        orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.judgement.count({ where }),
    ]);

    return paginated(rows.map((r) => this.toJudgementView(r)), total, page, pageSize);
  }

  // --------------------------------------------------------------------------
  // Similar judgements for one of the caller's cases
  // --------------------------------------------------------------------------

  async similarForCase(caseId: string, lawyerId: string | null): Promise<SimilarCaseView[]> {
    if (!lawyerId) {
      throw new BadRequestException('Complete onboarding first');
    }

    const legalCase = await this.prisma.case.findFirst({
      where: { id: caseId, lawyerId },
      include: { parties: { select: { name: true } } },
    });
    if (!legalCase) {
      throw new NotFoundException('Case not found');
    }

    const facts = [
      legalCase.title,
      legalCase.description ?? '',
      legalCase.practiceArea ?? '',
      legalCase.parties.map((p) => p.name).join(', '),
    ]
      .filter(Boolean)
      .join('. ');

    return this.similarSearch(facts, legalCase.practiceArea);
  }

  // --------------------------------------------------------------------------
  // Similar judgements from arbitrary free text
  // --------------------------------------------------------------------------

  async similarForText(text: string, practiceArea?: PracticeArea | null): Promise<SimilarCaseView[]> {
    return this.similarSearch(text, practiceArea ?? null);
  }

  /**
   * Vector similarity search with graceful degradation: embeds the text and
   * runs a pgvector nearest-neighbour query. If the AI provider is unavailable
   * (missing key -> 503) or no judgements have embeddings yet, falls back to a
   * plain text search filtered by practiceArea and returns those with score 0.
   */
  private async similarSearch(
    text: string,
    practiceArea: PracticeArea | null,
  ): Promise<SimilarCaseView[]> {
    const trimmed = text.trim();
    if (!trimmed) {
      return this.fallbackSearch(practiceArea);
    }

    let literal: string;
    try {
      const vec = await this.ai.embedOne(trimmed);
      literal = '[' + vec.join(',') + ']';
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        this.logger.warn('AI embeddings unavailable, falling back to text search');
        return this.fallbackSearch(practiceArea);
      }
      throw err;
    }

    const rows = await this.prisma.$queryRawUnsafe<JudgementRow[]>(
      `SELECT id, title, court, citation, "practiceArea", "decidedAt", summary, url,
              1 - (embedding <=> $1::vector) AS score
       FROM "Judgement"
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      literal,
      SIMILAR_LIMIT,
    );

    if (rows.length === 0) {
      // No judgements have embeddings yet -> degrade to text search.
      return this.fallbackSearch(practiceArea);
    }

    return rows.map((r) => this.toSimilarView(r, Number(r.score ?? 0)));
  }

  /** Plain text fallback: recent judgements optionally filtered by practice area, score 0. */
  private async fallbackSearch(practiceArea: PracticeArea | null): Promise<SimilarCaseView[]> {
    const rows = await this.prisma.judgement.findMany({
      where: practiceArea ? { practiceArea } : undefined,
      orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
      take: SIMILAR_LIMIT,
    });
    return rows.map((r) => this.toSimilarView(r, 0));
  }

  // --------------------------------------------------------------------------
  // Reindex: embed every judgement that is missing an embedding
  // --------------------------------------------------------------------------

  async reindex(): Promise<{ indexed: number }> {
    const pending = await this.prisma.$queryRawUnsafe<{ id: string; title: string; summary: string | null }[]>(
      `SELECT id, title, summary FROM "Judgement" WHERE embedding IS NULL`,
    );

    if (pending.length === 0) {
      return { indexed: 0 };
    }

    let indexed = 0;
    for (const j of pending) {
      const content = `${j.title}. ${j.summary ?? ''}`.trim();
      let literal: string;
      try {
        const vec = await this.ai.embedOne(content);
        literal = '[' + vec.join(',') + ']';
      } catch (err) {
        if (err instanceof ServiceUnavailableException) {
          this.logger.warn('AI embeddings unavailable, skipping reindex');
          return { indexed };
        }
        throw err;
      }

      await this.prisma.$executeRawUnsafe(
        'UPDATE "Judgement" SET embedding = $1::vector WHERE id = $2',
        literal,
        j.id,
      );
      indexed += 1;
    }

    return { indexed };
  }

  // --------------------------------------------------------------------------
  // Mappers
  // --------------------------------------------------------------------------

  private toJudgementView(row: {
    id: string;
    title: string;
    court: string | null;
    citation: string | null;
    practiceArea: PracticeArea | null;
    decidedAt: Date | null;
    summary: string | null;
    url: string | null;
  }): JudgementView {
    return {
      id: row.id,
      title: row.title,
      court: row.court,
      citation: row.citation,
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      summary: row.summary,
      practiceArea: row.practiceArea,
      url: row.url,
    };
  }

  private toSimilarView(row: JudgementRow, score: number): SimilarCaseView {
    return {
      ...this.toJudgementView(row),
      score,
    };
  }
}
