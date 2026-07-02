'use client';

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { InvoicesSection } from '@/components/billing/invoices-section';

export default function BillingPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoices"
        description="Raise GST invoices for your clients and track payments."
      />

      <InvoicesSection />

      <p className="text-sm text-muted-foreground">
        <CreditCard className="mr-1.5 inline h-4 w-4 align-[-2px]" />
        Looking for your Anura subscription? Manage your plan under{' '}
        <Link href="/settings?tab=billing" className="font-medium text-primary hover:underline">
          Settings → Plan &amp; Billing
        </Link>
        .
      </p>
    </div>
  );
}
