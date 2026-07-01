'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import type { PlanDefinition, SubscriptionPlan, SubscriptionView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button, Card, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { CheckoutResult } from './hooks';

interface PlansGridProps {
  plans: PlanDefinition[] | undefined;
  isLoading: boolean;
  subscription: SubscriptionView | undefined;
}

export function PlansGrid({ plans, isLoading, subscription }: PlansGridProps) {
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);

  const checkout = useMutation({
    mutationFn: (plan: SubscriptionPlan) => api.post<CheckoutResult>('/billing/checkout', { plan }),
    onMutate: (plan) => setPendingPlan(plan),
    onSuccess: (result) => {
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      if (result?.orderId) {
        toast.success(`Checkout started (order ${result.orderId}). Complete payment to upgrade.`);
        return;
      }
      toast.message('Billing is not configured for this workspace yet.');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 503) {
        toast.message('Payments are not configured yet. Please try again later.');
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
    onSettled: () => setPendingPlan(null),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
            <Skeleton className="mt-6 h-10 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Plans are unavailable right now.</p>
      </Card>
    );
  }

  const currentPlan = subscription?.plan;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const isCurrent = plan.plan === currentPlan;
        const priceLabel =
          plan.priceMonthly === 0 ? 'Free' : formatCurrency(plan.priceMonthly);
        return (
          <Card
            key={plan.plan}
            className={cn(
              'relative flex flex-col p-6 transition-shadow',
              isCurrent ? 'border-primary ring-1 ring-primary shadow-md' : 'hover:shadow-md',
            )}
          >
            {isCurrent && (
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                Current plan
              </span>
            )}

            <h3 className="text-base font-semibold">{plan.name}</h3>

            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-3xl font-semibold tracking-tight">
                {priceLabel}
              </span>
              {plan.priceMonthly > 0 && (
                <span className="text-sm text-muted-foreground">/mo</span>
              )}
            </div>

            <ul className="mt-5 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={isCurrent ? 'outline' : 'default'}
              className="mt-6 w-full"
              disabled={isCurrent}
              loading={pendingPlan === plan.plan}
              onClick={() => checkout.mutate(plan.plan)}
            >
              {isCurrent
                ? 'Your plan'
                : plan.priceMonthly === 0
                  ? 'Choose Starter'
                  : 'Upgrade'}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
