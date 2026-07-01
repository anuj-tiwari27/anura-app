import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PracticeArea } from '@anura/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** Query params for GET /research/judgements (text search + filters + pagination). */
export class QueryJudgementsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PracticeArea)
  practiceArea?: PracticeArea;

  @IsOptional()
  @IsString()
  court?: string;
}
