'use client';

import { CalendarClock, CreditCard, Users } from 'lucide-react';
import { PLANS, type SubscriptionView } from '@anura/shared';
import { Card, Skeleton, StatusBadge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

interface CurrentPlanProps {
  subscription: SubscriptionView | undefined;
  isLoading: boolean;
}

export function CurrentPlan({ subscription, isLoading }: CurrentPlanProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load your subscription. Please refresh and try again.
        </p>
      </Card>
    );
  }

  const plan = PLANS[subscription.plan];
  const priceLabel =
    plan.priceMonthly === 0 ? 'Free' : `${formatCurrency(plan.priceMonthly)}/mo`;

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Current plan
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-tight">{plan.name}</h2>
            <StatusBadge kind="subscription" value={subscription.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{priceLabel}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetaItem icon={Users} label="Seats" value={String(subscription.seats)} />
        <MetaItem
          icon={CalendarClock}
          label={subscription.status === 'CANCELLED' ? 'Access until' : 'Renews on'}
          value={formatDate(subscription.currentPeriodEnd)}
        />
        <MetaItem
          icon={CreditCard}
          label="Billing"
          value={subscription.provider ? titleCase(subscription.provider) : 'Not configured'}
        />
      </dl>
    </Card>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
