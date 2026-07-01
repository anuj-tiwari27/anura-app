import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TimelineEventType } from '@anura/shared';

export class CreateTimelineDto {
  @IsEnum(TimelineEventType)
  type!: TimelineEventType;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsISO8601()
  eventDate!: string;
}
