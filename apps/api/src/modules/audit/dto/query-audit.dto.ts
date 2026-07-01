import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** Query params for GET /audit — pagination + optional entity filters. */
export class QueryAuditDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  entityId?: string;
}
