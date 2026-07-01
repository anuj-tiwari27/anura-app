import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** Query params for GET /documents: pagination + optional case filter. */
export class QueryDocumentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  caseId?: string;
}
