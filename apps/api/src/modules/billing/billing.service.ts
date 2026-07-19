import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { CaseParty, Invoice, Subscription } from '@prisma/client';
import {
  DEFAULT_GST_PERCENT,
  InvoiceStatus,
  PLANS,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@anura/shared';
import type {
  InvoiceLineItem,
  InvoiceShareResult,
  InvoiceView,
  Paginated,
  PlanDefinition,
  PublicInvoiceView,
  SelectPlanResult,
  SendInvoiceResult,
  SubscriptionView,
} from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../../integrations/payments/payments.service';
import type { CheckoutResult } from '../../integrations/payments/payments.service';
import { WhatsAppService } from '../../integrations/messaging/whatsapp.service';
import { EmailService } from '../../integrations/email/email.service';
import { paginated, skipTake } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
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

  /**
   * Records the plan chosen during signup. Runs before onboarding, so it
   * resolves (or creates) the caller's Lawyer row from the user id rather than
   * requiring a lawyerId. Free plans activate immediately; paid plans are
   * recorded as TRIALING and, when a payments provider is configured, return a
   * checkout URL to complete payment.
   */
  async selectPlan(
    userId: string,
    email: string,
    plan: SubscriptionPlan,
  ): Promise<SelectPlanResult> {
    const definition = PLANS[plan];
    if (!definition) {
      throw new BadRequestException(`Unknown plan: ${plan}`);
    }

    const lawyer = await this.prisma.lawyer.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const isFree = definition.priceMonthly === 0;
    const status = isFree ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING;
    const data = { plan, status, seats: definition.seats };

    const subscription = await this.prisma.subscription.upsert({
      where: { lawyerId: lawyer.id },
      create: { lawyerId: lawyer.id, ...data },
      update: data,
    });

    let checkoutUrl: string | null = null;
    if (!isFree && this.payments.provider !== 'none') {
      try {
        const checkout = await this.payments.createCheckout({
          plan,
          amount: definition.priceMonthly,
          customerEmail: email,
          metadata: { lawyerId: lawyer.id, plan },
        });
        checkoutUrl = checkout.url;
      } catch (err) {
        // The choice is already recorded; payment can be completed later from
        // Settings rather than blocking the signup flow.
        this.logger.warn(`Checkout unavailable during plan selection: ${(err as Error).message}`);
      }
    }

    return { subscription: this.toSubscriptionView(subscription), checkoutUrl };
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

  // -- Share link + send ------------------------------------------------------

  /** Generates (or reuses) the public share link for an invoice. */
  async shareInvoice(lawyerId: string, id: string): Promise<InvoiceShareResult> {
    const invoice = await this.findOwnedInvoice(lawyerId, id);
    const token = await this.ensureShareToken(invoice);
    return { token, url: this.shareUrl(token) };
  }

  /** Public (unauthenticated) invoice lookup by share token. */
  async getPublicInvoice(token: string): Promise<PublicInvoiceView> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { shareToken: token },
      include: { lawyer: { include: { user: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return {
      ...this.toInvoiceView(invoice),
      fromName: invoice.lawyer.user.fullName ?? null,
    };
  }

  /** Sends the invoice share link to the client via WhatsApp or email. */
  async sendInvoice(
    lawyerId: string,
    id: string,
    dto: SendInvoiceDto,
    userId?: string,
  ): Promise<SendInvoiceResult> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lawyer: { include: { user: true } },
        case: { include: { parties: true } },
      },
    });
    if (!invoice || invoice.lawyerId !== lawyerId) {
      throw new NotFoundException('Invoice not found');
    }

    const token = await this.ensureShareToken(invoice);
    const url = this.shareUrl(token);

    const to = dto.to ?? this.resolveRecipient(invoice.case?.parties ?? [], dto.channel);
    if (!to) {
      throw new BadRequestException(
        'No client phone/email on the linked case — add it to the client party or pass one explicitly',
      );
    }

    const fromName = invoice.lawyer.user.fullName;
    const total = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: invoice.currency,
      maximumFractionDigits: 2,
    }).format(Number(invoice.total));
    const dueLine = invoice.dueAt
      ? ` It is due by ${invoice.dueAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      : '';
    const message =
      `Dear ${invoice.clientName ?? 'client'},\n\n` +
      `Please find invoice ${invoice.number} for ${total}.${dueLine}\n` +
      `View and download it here: ${url}\n\n` +
      `Regards,\n${fromName ?? 'Your advocate'}`;

    const result =
      dto.channel === 'whatsapp'
        ? await this.whatsapp.sendText(to, message)
        : await this.email.sendEmail({
            to,
            subject: `Invoice ${invoice.number} from ${fromName ?? 'your advocate'}`,
            text: message,
          });

    // Sending a draft invoice implicitly issues it.
    if (invoice.status === InvoiceStatus.DRAFT) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.SENT, issuedAt: new Date() },
      });
    }

    void this.audit.log({
      actorId: userId ?? null,
      action: 'invoice.send',
      entityType: 'INVOICE',
      entityId: invoice.id,
      meta: { number: invoice.number, channel: dto.channel },
    });
    return { ok: result.ok, channel: dto.channel, to, url };
  }

  private shareUrl(token: string): string {
    return `${this.config.get<string>('webOrigin')}/invoice/${token}`;
  }

  private async ensureShareToken(invoice: Invoice): Promise<string> {
    if (invoice.shareToken) return invoice.shareToken;
    const token = randomBytes(24).toString('base64url');
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { shareToken: token },
    });
    return token;
  }

  /** Picks the best recipient from case parties: client party first, then any. */
  private resolveRecipient(parties: CaseParty[], channel: 'whatsapp' | 'email'): string | null {
    const field = channel === 'whatsapp' ? 'contactPhone' : 'contactEmail';
    const client = parties.find((p) => p.isClient && p[field]);
    const fallback = parties.find((p) => p[field]);
    return client?.[field] ?? fallback?.[field] ?? null;
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
