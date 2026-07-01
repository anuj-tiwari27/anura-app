import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { Paginated } from '@anura/shared';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

/** Wraps a page of results in the shared Paginated<T> envelope. */
export function paginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Prisma skip/take from a 1-based page. */
export function skipTake(page = 1, pageSize = 20): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
