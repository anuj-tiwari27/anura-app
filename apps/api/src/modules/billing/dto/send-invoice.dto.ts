import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendInvoiceDto {
  @IsIn(['whatsapp', 'email'])
  channel!: 'whatsapp' | 'email';

  /** Explicit recipient (phone/email). Falls back to the case's client party. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  to?: string;
}
