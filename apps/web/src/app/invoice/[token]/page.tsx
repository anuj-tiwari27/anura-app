'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileX2, Printer } from 'lucide-react';
import type { PublicInvoiceView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button, Spinner, StatusBadge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

/**
 * Public, unauthenticated invoice view reached via a share link
 * (/invoice/<token>). Print-friendly: the browser's "Save as PDF" is the
 * download path, so everything non-essential is hidden on print.
 */
export default function PublicInvoicePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data: invoice, isLoading, isError, error } = useQuery({
    queryKey: ['public-invoice', token],
    queryFn: () =>
      api.get<PublicInvoiceView>(`/billing/public/invoices/${encodeURIComponent(token)}`, {
        auth: false,
      }),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError || !invoice) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileX2 className="h-6 w-6" />
        </span>
        <h1 className="font-display text-xl font-semibold">
          {notFound ? 'Invoice not found' : 'Could not load invoice'}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {notFound
            ? 'This link is invalid or has been revoked. Please ask the sender for a new one.'
            : 'Something went wrong. Please try again in a moment.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <span className="font-display text-lg font-semibold">Anura</span>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-display text-xl font-semibold">{invoice.fromName ?? 'Advocate'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Professional fee invoice</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice</p>
              <p className="font-semibold">{invoice.number}</p>
              <div className="mt-1">
                <StatusBadge kind="invoice" value={invoice.status} />
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</p>
              <p className="mt-1 font-medium">{invoice.clientName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Issued</p>
              <p className="mt-1 font-medium">{formatDate(invoice.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Due</p>
              <p className="mt-1 font-medium">{formatDate(invoice.dueAt)}</p>
            </div>
          </div>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit price</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3">{item.description}</td>
                  <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium tabular-nums">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-6 w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums text-foreground">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>GST ({invoice.gstPercent}%)</span>
              <span className="tabular-nums text-foreground">{formatCurrency(invoice.gstAmount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          <p className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Generated by Anura · anura.legal
          </p>
        </div>
      </div>
    </div>
  );
}
