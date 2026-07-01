import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

/**
 * Billing feature module: plans, subscription, Stripe/Razorpay checkout,
 * GST invoices and the Stripe webhook. PrismaService and PaymentsService are
 * injected from their global modules (no imports needed here).
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
