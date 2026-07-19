'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import type { PlanDefinition, SelectPlanResult, SubscriptionPlan } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Button, Card, Skeleton, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Final step of signup, after email verification and profile setup. Free
 * activates immediately; a paid plan is recorded and, when a payments provider
 * is configured, sends the user to checkout. Either way they land on the
 * dashboard — billing can be completed later from Settings, so this never
 * blocks getting started.
 */
export default function ChoosePlanPage() {
  const router = useRouter();
  const { status, loadMe } = useAuth();
  const [pending, setPending] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    if (useAuth.getState().status === 'idle') void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const plans = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<PlanDefinition[]>('/billing/plans'),
    enabled: status === 'authenticated',
  });

  const choose = async (plan: SubscriptionPlan) => {
    setPending(plan);
    try {
      const res = await api.post<SelectPlanResult>('/billing/select-plan', { plan });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.success(`You're on the ${plan === 'FREE' ? 'Starter' : 'selected'} plan`);
      router.replace('/dashboard');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not select that plan');
    } finally {
      setPending(null);
    }
  };

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <span className="font-display text-2xl font-semibold">Anura</span>
          <h1 className="mt-4 font-display text-3xl font-semibold">Choose your plan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start free and upgrade whenever you need to. You can change this any time from
            Settings.
          </p>
        </div>

        {plans.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="mt-3 h-8 w-28" />
                <div className="mt-6 space-y-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
                <Skeleton className="mt-6 h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(plans.data ?? []).map((plan) => {
              const isFree = plan.priceMonthly === 0;
              const highlighted = plan.plan === 'SOLO';
              return (
                <Card
                  key={plan.plan}
                  className={cn(
                    'relative flex flex-col p-6 transition-shadow hover:shadow-md',
                    highlighted && 'border-primary ring-1 ring-primary',
                  )}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                      Most popular
                    </span>
                  )}

                  <h2 className="text-base font-semibold">{plan.name}</h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-semibold tracking-tight">
                      {isFree ? 'Free' : formatCurrency(plan.priceMonthly)}
                    </span>
                    {!isFree && <span className="text-sm text-muted-foreground">/mo</span>}
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
                    variant={highlighted ? 'default' : 'outline'}
                    className="mt-6 w-full"
                    loading={pending === plan.plan}
                    disabled={pending !== null}
                    onClick={() => void choose(plan.plan)}
                  >
                    {isFree ? 'Start free' : `Choose ${plan.name}`}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void choose('FREE')}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
          >
            Skip for now — start on the free plan
          </button>
        </div>
      </div>
    </div>
  );
}
