import { IsOptional, IsString } from 'class-validator';

/** Body fields for POST /documents (multipart). The file arrives via @UploadedFile. */
export class UploadDocumentDto {
  @IsOptional()
  @IsString()
  caseId?: string;
}
