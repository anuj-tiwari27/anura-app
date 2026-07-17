'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { InvoiceStatus, Labels, type InvoiceView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Button, Field, Modal, Select, StatusBadge, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { printInvoice } from './print-invoice';

interface InvoiceDetailModalProps {
  invoice: InvoiceView | null;
  onClose: () => void;
}

export function InvoiceDetailModal({ invoice, onClose }: InvoiceDetailModalProps) {
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);

  const updateStatus = useMutation({
    mutationFn: (status: InvoiceStatus) =>
      api.patch<InvoiceView>(`/billing/invoices/${invoice!.id}`, { status }),
    onSuccess: (updated) => {
      toast.success(`Invoice marked ${Labels.InvoiceStatus[updated.status]}`);
      void queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  return (
    <Modal
      open={!!invoice}
      onClose={onClose}
      className="max-w-2xl"
      title={invoice ? `Invoice ${invoice.number}` : undefined}
    >
      {invoice && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Billed to</p>
              <p className="font-medium">{invoice.clientName ?? '—'}</p>
            </div>
            <StatusBadge kind="invoice" value={invoice.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Meta label="Issued" value={formatDate(invoice.issuedAt)} />
            <Meta label="Due" value={formatDate(invoice.dueAt)} />
            <Meta label="Currency" value={invoice.currency} />
          </div>

          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Description</TH>
                <TH className="text-right">Qty</TH>
                <TH className="text-right">Unit price</TH>
                <TH className="text-right">Amount</TH>
              </TR>
            </THead>
            <TBody>
              {invoice.items.map((item, i) => (
                <TR key={i} className="hover:bg-transparent">
                  <TD>{item.description}</TD>
                  <TD className="text-right tabular-nums">{item.quantity}</TD>
                  <TD className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(item.unitPrice)}
                  </TD>
                  <TD className="text-right font-medium tabular-nums">
                    {formatCurrency(item.amount)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatCurrency(invoice.subtotal)} />
            <Row label={`GST (${invoice.gstPercent}%)`} value={formatCurrency(invoice.gstAmount)} />
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
            <Field label="Update status" className="sm:w-56" htmlFor="invoice-status">
              <Select
                id="invoice-status"
                value={invoice.status}
                disabled={updateStatus.isPending}
                onChange={(e) => updateStatus.mutate(e.target.value as InvoiceStatus)}
              >
                {Object.values(InvoiceStatus).map((s) => (
                  <option key={s} value={s}>
                    {Labels.InvoiceStatus[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const ok = printInvoice(invoice, user?.fullName ?? 'Advocate');
                  if (!ok) toast.error('Allow pop-ups to download the invoice');
                }}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
