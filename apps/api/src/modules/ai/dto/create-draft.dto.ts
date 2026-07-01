import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TemplateType } from '@anura/shared';

export class CreateDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  prompt!: string;

  @IsOptional()
  @IsString()
  caseId?: string;

  @IsOptional()
  @IsEnum(TemplateType)
  templateType?: TemplateType;
}
