import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { InvoiceStatus } from '@anura/shared';
import type {
  InvoiceView,
  Paginated,
  PlanDefinition,
  SubscriptionView,
} from '@anura/shared';
import type { CheckoutResult } from '../../integrations/payments/payments.service';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { requireLawyer } from './require-lawyer';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

/** Query params for the invoice list endpoint. */
class ListInvoicesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  getPlans(): PlanDefinition[] {
    return this.billing.listPlans();
  }

  @Get('subscription')
  getSubscription(@CurrentUser('lawyerId') lawyerId: string | null): Promise<SubscriptionView> {
    return this.billing.getSubscription(requireLawyer(lawyerId));
  }

  @Post('checkout')
  checkout(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @CurrentUser('email') email: string,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutResult> {
    return this.billing.checkout(requireLawyer(lawyerId), email, dto.plan);
  }

  @Get('invoices')
  listInvoices(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Query() query: ListInvoicesQueryDto,
  ): Promise<Paginated<InvoiceView>> {
    return this.billing.listInvoices(
      requireLawyer(lawyerId),
      query.page,
      query.pageSize,
      query.status,
    );
  }

  @Post('invoices')
  createInvoice(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Body() dto: CreateInvoiceDto,
  ): Promise<InvoiceView> {
    return this.billing.createInvoice(requireLawyer(lawyerId), dto);
  }

  @Get('invoices/:id')
  getInvoice(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
  ): Promise<InvoiceView> {
    return this.billing.getInvoice(requireLawyer(lawyerId), id);
  }

  @Patch('invoices/:id')
  updateInvoice(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ): Promise<InvoiceView> {
    return this.billing.updateInvoice(requireLawyer(lawyerId), id, dto);
  }

  @Public()
  @Post('webhook/stripe')
  @HttpCode(200)
  async stripeWebhook(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    const signature = req.headers['stripe-signature'];
    await this.billing.handleStripeWebhook(
      req.rawBody,
      Array.isArray(signature) ? signature[0] : signature,
    );
    return { received: true };
  }
}
