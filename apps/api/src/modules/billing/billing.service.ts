import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Invoice, Subscription } from '@prisma/client';
import {
  DEFAULT_GST_PERCENT,
  InvoiceStatus,
  PLANS,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@anura/shared';
import type {
  InvoiceLineItem,
  InvoiceView,
  Paginated,
  PlanDefinition,
  SubscriptionView,
} from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../../integrations/payments/payments.service';
import type { CheckoutResult } from '../../integrations/payments/payments.service';
import { paginated, skipTake } from '../../common/dto/pagination.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  // -- Plans ----------------------------------------------------------------

  listPlans(): PlanDefinition[] {
    return Object.values(PLANS);
  }

  // -- Subscription ---------------------------------------------------------

  async getSubscription(lawyerId: string): Promise<SubscriptionView> {
    const sub = await this.prisma.subscription.findUnique({ where: { lawyerId } });
    if (!sub) {
      // No subscription row yet -> present the implicit FREE / TRIALING default.
      return {
        id: '',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.TRIALING,
        seats: 1,
        currentPeriodEnd: null,
        provider: null,
      };
    }
    return this.toSubscriptionView(sub);
  }

  // -- Checkout -------------------------------------------------------------

  async checkout(
    lawyerId: string,
    email: string,
    plan: SubscriptionPlan,
  ): Promise<CheckoutResult> {
    const definition = PLANS[plan];
    if (!definition) {
      throw new BadRequestException(`Unknown plan: ${plan}`);
    }
    // Let a missing provider surface as 503 (ServiceUnavailableException) upstream.
    return this.payments.createCheckout({
      plan,
      amount: definition.priceMonthly,
      customerEmail: email,
      metadata: { lawyerId, plan },
    });
  }

  // -- Invoices -------------------------------------------------------------

  async listInvoices(
    lawyerId: string,
    page: number,
    pageSize: number,
    status?: InvoiceStatus,
  ): Promise<Paginated<InvoiceView>> {
    const where: Prisma.InvoiceWhereInput = { lawyerId };
    if (status) where.status = status;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginated(rows.map((r) => this.toInvoiceView(r)), total, page, pageSize);
  }

  async createInvoice(lawyerId: string, dto: CreateInvoiceDto): Promise<InvoiceView> {
    if (dto.caseId) {
      await this.assertCaseOwnership(lawyerId, dto.caseId);
    }

    const items: InvoiceLineItem[] = dto.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: round2(item.quantity * item.unitPrice),
    }));

    const subtotal = round2(items.reduce((sum, item) => sum + item.amount, 0));
    const gstPercent = dto.gstPercent ?? DEFAULT_GST_PERCENT;
    const gstAmount = round2((subtotal * gstPercent) / 100);
    const total = round2(subtotal + gstAmount);

    const number = await this.nextInvoiceNumber(lawyerId);

    const created = await this.prisma.invoice.create({
      data: {
        lawyerId,
        caseId: dto.caseId ?? null,
        number,
        status: InvoiceStatus.DRAFT,
        clientName: dto.clientName ?? null,
        subtotal: new Prisma.Decimal(subtotal),
        gstPercent: new Prisma.Decimal(gstPercent),
        gstAmount: new Prisma.Decimal(gstAmount),
        total: new Prisma.Decimal(total),
        items: items as unknown as Prisma.InputJsonValue,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
    });

    return this.toInvoiceView(created);
  }

  async getInvoice(lawyerId: string, id: string): Promise<InvoiceView> {
    const invoice = await this.findOwnedInvoice(lawyerId, id);
    return this.toInvoiceView(invoice);
  }

  async updateInvoice(
    lawyerId: string,
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<InvoiceView> {
    const existing = await this.findOwnedInvoice(lawyerId, id);

    const data: Prisma.InvoiceUpdateInput = {};
    if (dto.status && dto.status !== existing.status) {
      data.status = dto.status;
      // Stamp issuedAt the first time the invoice is actually sent.
      if (dto.status === InvoiceStatus.SENT && !existing.issuedAt) {
        data.issuedAt = new Date();
      }
    }

    const updated = await this.prisma.invoice.update({ where: { id }, data });
    return this.toInvoiceView(updated);
  }

  // -- Stripe webhook -------------------------------------------------------

  /**
   * Verify + handle a Stripe webhook. Never throws: on any parsing/config
   * error we log and return so Stripe still receives a 200 {received:true}.
   */
  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    if (!rawBody || !signature) {
      this.logger.warn('Stripe webhook missing raw body or signature; ignoring');
      return;
    }

    let event;
    try {
      event = this.payments.parseStripeWebhook(rawBody, signature);
    } catch (err) {
      this.logger.error(`Failed to parse Stripe webhook: ${(err as Error).message}`);
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as {
          metadata?: Record<string, string> | null;
          subscription?: string | null;
          customer?: string | null;
        };
        const lawyerId = session.metadata?.lawyerId;
        const plan = session.metadata?.plan as SubscriptionPlan | undefined;
        if (lawyerId && plan && PLANS[plan]) {
          await this.activateSubscription(lawyerId, plan, session.subscription ?? null);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to handle Stripe event ${event.type}: ${(err as Error).message}`);
    }
  }

  private async activateSubscription(
    lawyerId: string,
    plan: SubscriptionPlan,
    providerSubId: string | null,
  ): Promise<void> {
    // Ignore events for lawyers that no longer exist (FK would otherwise throw).
    const lawyer = await this.prisma.lawyer.findUnique({ where: { id: lawyerId }, select: { id: true } });
    if (!lawyer) {
      this.logger.warn(`Stripe webhook references unknown lawyer ${lawyerId}; ignoring`);
      return;
    }

    const seats = PLANS[plan].seats;
    await this.prisma.subscription.upsert({
      where: { lawyerId },
      create: {
        lawyerId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        seats,
        provider: 'stripe',
        providerSubId,
      },
      update: {
        plan,
        status: SubscriptionStatus.ACTIVE,
        seats,
        provider: 'stripe',
        providerSubId,
      },
    });
    this.logger.log(`Activated ${plan} subscription for lawyer ${lawyerId}`);
  }

  // -- Helpers --------------------------------------------------------------

  private async assertCaseOwnership(lawyerId: string, caseId: string): Promise<void> {
    const found = await this.prisma.case.findFirst({
      where: { id: caseId, lawyerId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException('Case not found');
    }
  }

  private async findOwnedInvoice(lawyerId: string, id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.lawyerId !== lawyerId) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  private async nextInvoiceNumber(lawyerId: string): Promise<string> {
    const count = await this.prisma.invoice.count({ where: { lawyerId } });
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${year}-${sequence}`;
  }

  private toSubscriptionView(sub: Subscription): SubscriptionView {
    return {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      seats: sub.seats,
      currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
      provider: sub.provider,
    };
  }

  private toInvoiceView(invoice: Invoice): InvoiceView {
    return {
      id: invoice.id,
      number: invoice.number,
      caseId: invoice.caseId,
      clientName: invoice.clientName,
      status: invoice.status,
      currency: invoice.currency,
      subtotal: Number(invoice.subtotal),
      gstPercent: Number(invoice.gstPercent),
      gstAmount: Number(invoice.gstAmount),
      total: Number(invoice.total),
      items: toLineItems(invoice.items),
      issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
      dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
      createdAt: invoice.createdAt.toISOString(),
    };
  }
}

/** Rounds to 2 decimals to avoid floating-point drift in money math. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Coerces the stored `items` JSON back into typed line items. */
function toLineItems(value: Prisma.JsonValue): InvoiceLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      amount: Number(item.amount ?? 0),
    };
  });
}
