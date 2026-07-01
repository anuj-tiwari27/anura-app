import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CourtType, PracticeArea } from '@anura/shared';

/**
 * Body for POST /users/onboarding.
 * Creates/updates the caller's Lawyer profile and marks onboarding complete.
 * If `skip` is true only `fullName` is required — a minimal Lawyer is created.
 */
export class OnboardingDto {
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(PracticeArea, { each: true })
  practiceAreas?: PracticeArea[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  courts?: string[];

  @IsOptional()
  @IsEnum(CourtType)
  primaryCourtType?: CourtType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  barCouncilId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsBoolean()
  skip?: boolean;
}
