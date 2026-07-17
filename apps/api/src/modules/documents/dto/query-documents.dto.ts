import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** Query params for GET /documents: pagination + optional case filter + archived view. */
export class QueryDocumentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  caseId?: string;

  /** When true, return ONLY archived documents; otherwise archived are hidden. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  archived?: boolean;
}
