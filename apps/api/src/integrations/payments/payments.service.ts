import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { SubscriptionPlan } from '@anura/shared';
import type { AppConfig } from '../../config/configuration';

export interface CheckoutInput {
  plan: SubscriptionPlan;
  amount: number; // INR (major units)
  currency?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  provider: string;
  id: string;
  url: string | null;
  orderId?: string;
  keyId?: string;
  amount: number;
  currency: string;
}

/**
 * Billing provider facade. `stripe` -> Checkout Session (redirect URL),
 * `razorpay` -> Order (client-side checkout), `none` -> 503.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private _stripe?: Stripe;

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['payments'] {
    return this.config.get<AppConfig['payments']>('payments')!;
  }

  get provider(): string {
    return this.cfg.provider;
  }

  private stripe(): Stripe {
    if (!this._stripe) {
      if (!this.cfg.stripeSecretKey) {
        throw new ServiceUnavailableException('STRIPE_SECRET_KEY is not configured');
      }
      this._stripe = new Stripe(this.cfg.stripeSecretKey);
    }
    return this._stripe;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const currency = input.currency ?? 'INR';
    const amountMinor = Math.round(input.amount * 100);

    if (this.cfg.provider === 'stripe') {
      const session = await this.stripe().checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: amountMinor,
              product_data: { name: `Anura ${input.plan} plan` },
            },
          },
        ],
        customer_email: input.customerEmail,
        success_url: input.successUrl ?? `${this.webOrigin}/billing?status=success`,
        cancel_url: input.cancelUrl ?? `${this.webOrigin}/billing?status=cancelled`,
        metadata: input.metadata,
      });
      return {
        provider: 'stripe',
        id: session.id,
        url: session.url,
        amount: input.amount,
        currency,
      };
    }

    if (this.cfg.provider === 'razorpay') {
      if (!this.cfg.razorpayKeyId || !this.cfg.razorpayKeySecret) {
        throw new ServiceUnavailableException('RAZORPAY keys are not configured');
      }
      const auth = Buffer.from(`${this.cfg.razorpayKeyId}:${this.cfg.razorpayKeySecret}`).toString('base64');
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountMinor, currency, notes: input.metadata }),
      });
      if (!res.ok) {
        this.logger.error(`Razorpay order failed: ${await res.text()}`);
        throw new ServiceUnavailableException('Failed to create Razorpay order');
      }
      const order = (await res.json()) as { id: string };
      return {
        provider: 'razorpay',
        id: order.id,
        orderId: order.id,
        keyId: this.cfg.razorpayKeyId,
        url: null,
        amount: input.amount,
        currency,
      };
    }

    throw new ServiceUnavailableException('No payments provider configured (PAYMENTS_PROVIDER=none)');
  }

  /** Verify + parse a Stripe webhook. Throws if the signature is invalid. */
  parseStripeWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.cfg.stripeWebhookSecret) {
      throw new ServiceUnavailableException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.stripe().webhooks.constructEvent(rawBody, signature, this.cfg.stripeWebhookSecret);
  }

  private get webOrigin(): string {
    return this.config.get<string>('webOrigin') ?? 'http://localhost:3000';
  }
}
