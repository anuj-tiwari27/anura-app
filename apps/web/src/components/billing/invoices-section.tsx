'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Receipt } from 'lucide-react';
import { InvoiceStatus, Labels, type InvoiceView, type Paginated } from '@anura/shared';
import { api, ApiError, buildQuery } from '@/lib/api-client';
import {
  Button,
  Card,
  EmptyState,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { NewInvoiceModal } from './new-invoice-modal';
import { InvoiceDetailModal } from './invoice-detail-modal';

const PAGE_SIZE = 10;

export function InvoicesSection() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<InvoiceView | null>(null);

  const query = useQuery({
    queryKey: ['billing', 'invoices', { status, page }],
    queryFn: () =>
      api.get<Paginated<InvoiceView>>(
        `/billing/invoices${buildQuery({ page, pageSize: PAGE_SIZE, status: status || undefined })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const invoices = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const total = query.data?.total ?? 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <div className="w-40">
            <Select
              value={status}
              aria-label="Filter invoices by status"
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Object.values(InvoiceStatus).map((s) => (
                <option key={s} value={s}>
                  {Labels.InvoiceStatus[s]}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New invoice
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={Receipt}
          title="Couldn't load invoices"
          description={
            query.error instanceof ApiError ? query.error.message : 'Please try again in a moment.'
          }
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={status ? 'No invoices match this filter' : 'No invoices yet'}
          description={
            status
              ? 'Try a different status filter.'
              : 'Create your first invoice to start billing clients.'
          }
          action={
            status ? (
              <Button
                variant="outline"
                onClick={() => {
                  setStatus('');
                  setPage(1);
                }}
              >
                Clear filter
              </Button>
            ) : (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New invoice
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table className="border-0">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Number</TH>
                <TH className="hidden sm:table-cell">Client</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
                <TH className="hidden md:table-cell">Issued</TH>
                <TH className="hidden lg:table-cell">Due</TH>
              </TR>
            </THead>
            <TBody>
              {invoices.map((inv) => (
                <TR key={inv.id} className="cursor-pointer" onClick={() => setSelected(inv)}>
                  <TD className="font-medium">{inv.number}</TD>
                  <TD className="hidden text-muted-foreground sm:table-cell">
                    {inv.clientName ?? '—'}
                  </TD>
                  <TD>
                    <StatusBadge kind="invoice" value={inv.status} />
                  </TD>
                  <TD className="text-right font-medium tabular-nums">
                    {formatCurrency(inv.total, inv.currency)}
                  </TD>
                  <TD className="hidden text-muted-foreground md:table-cell">
                    {formatDate(inv.issuedAt)}
                  </TD>
                  <TD className="hidden text-muted-foreground lg:table-cell">
                    {formatDate(inv.dueAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {total} invoice{total === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || query.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <NewInvoiceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <InvoiceDetailModal invoice={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
