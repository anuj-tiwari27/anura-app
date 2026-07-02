import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CaseStatus, CourtType, PracticeArea } from '@anura/shared';
import { CreatePartyDto } from './create-party.dto';

export class CreateCaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  caseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cnr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  court?: string;

  @IsOptional()
  @IsEnum(CourtType)
  courtType?: CourtType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  jurisdiction?: string;

  @IsOptional()
  @IsEnum(PracticeArea)
  practiceArea?: PracticeArea;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientName?: string;

  @IsOptional()
  @IsISO8601()
  filedAt?: string;

  @IsOptional()
  @IsISO8601()
  nextHearingDate?: string;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  /** Parties to create with the case (used by the eCourts CNR import). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreatePartyDto)
  parties?: CreatePartyDto[];
}
