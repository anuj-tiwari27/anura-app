'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlanDefinition, SubscriptionView } from '@anura/shared';
import { api } from '@/lib/api-client';

/**
 * Shape returned by POST /billing/checkout. Not exported from @anura/shared,
 * so we type it locally: either a hosted redirect URL (Stripe) or a
 * provider order id (Razorpay), depending on how billing is configured.
 */
export interface CheckoutResult {
  url?: string | null;
  orderId?: string | null;
  provider?: string | null;
}

/** Current subscription for the active lawyer. */
export function useSubscription() {
  return useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api.get<SubscriptionView>('/billing/subscription'),
    staleTime: 30_000,
  });
}

/** Plan catalogue (mirrors PLANS in @anura/shared, served from the API). */
export function usePlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<PlanDefinition[]>('/billing/plans'),
    staleTime: 5 * 60_000,
  });
}
