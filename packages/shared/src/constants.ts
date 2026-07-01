import { SubscriptionPlan } from './enums.js';

/** API version prefix used by the NestJS global prefix and the web API client. */
export const API_PREFIX = 'api/v1';

/** Subscription plan catalogue (amounts in INR paise for billing providers). */
export interface PlanDefinition {
  plan: SubscriptionPlan;
  name: string;
  priceMonthly: number; // INR, whole rupees for display
  seats: number;
  caseLimit: number | null; // null = unlimited
  aiDraftsPerMonth: number | null;
  features: string[];
}

export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  FREE: {
    plan: 'FREE',
    name: 'Starter',
    priceMonthly: 0,
    seats: 1,
    caseLimit: 10,
    aiDraftsPerMonth: 15,
    features: ['Up to 10 cases', 'Document vault (1 GB)', '15 AI drafts / month', 'WhatsApp reminders'],
  },
  SOLO: {
    plan: 'SOLO',
    name: 'Solo Advocate',
    priceMonthly: 1499,
    seats: 1,
    caseLimit: null,
    aiDraftsPerMonth: 200,
    features: ['Unlimited cases', 'e-Courts CNR sync', '200 AI drafts / month', 'Previous-judgement search'],
  },
  TEAM: {
    plan: 'TEAM',
    name: 'Chamber',
    priceMonthly: 3999,
    seats: 5,
    caseLimit: null,
    aiDraftsPerMonth: 1000,
    features: ['Everything in Solo', 'Up to 5 seats', 'Shared document vault', 'Staff task management'],
  },
  FIRM: {
    plan: 'FIRM',
    name: 'Firm',
    priceMonthly: 9999,
    seats: 25,
    caseLimit: null,
    aiDraftsPerMonth: null,
    features: ['Everything in Chamber', 'Up to 25 seats', 'Unlimited AI drafts', 'Priority support & audit exports'],
  },
};

/** Default embedding dimension (OpenAI text-embedding-3-large, sliced). */
export const EMBEDDING_DIMENSIONS = 1536;

/** GST rate applied to Indian invoices (percent). */
export const DEFAULT_GST_PERCENT = 18;
