'use client';

import { PageHeader } from '@/components/ui';
import { CurrentPlan } from '@/components/billing/current-plan';
import { PlansGrid } from '@/components/billing/plans-grid';
import { InvoicesSection } from '@/components/billing/invoices-section';
import { usePlans, useSubscription } from '@/components/billing/hooks';

export default function BillingPage() {
  const subscription = useSubscription();
  const plans = usePlans();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description="Manage your subscription, compare plans, and raise client invoices."
      />

      <CurrentPlan subscription={subscription.data} isLoading={subscription.isLoading} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Upgrade any time. Changes take effect from your next billing cycle.
          </p>
        </div>
        <PlansGrid
          plans={plans.data}
          isLoading={plans.isLoading}
          subscription={subscription.data}
        />
      </section>

      <InvoicesSection />
    </div>
  );
}
