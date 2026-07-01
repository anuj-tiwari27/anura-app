import { IsEnum, IsOptional } from 'class-validator';
import { InvoiceStatus } from '@anura/shared';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
