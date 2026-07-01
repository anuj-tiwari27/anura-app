import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PracticeArea } from '@anura/shared';

/** Query params for GET /research/similar?caseId=. */
export class SimilarByCaseDto {
  @IsString()
  caseId!: string;
}

/** Body for POST /research/similar (free-text vector search). */
export class SimilarByTextDto {
  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  text!: string;

  @IsOptional()
  @IsEnum(PracticeArea)
  practiceArea?: PracticeArea;
}
