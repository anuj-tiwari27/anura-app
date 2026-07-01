import { IsEnum, IsOptional } from 'class-validator';
import { CaseStatus } from '@anura/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryCasesDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}
