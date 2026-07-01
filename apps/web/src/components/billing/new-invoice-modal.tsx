'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { DEFAULT_GST_PERCENT, type InvoiceView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { useCaseOptions } from '@/components/documents/hooks';

interface NewInvoiceModalProps {
  open: boolean;
  onClose: () => void;
}

interface DraftLine {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

let lineKeySeq = 0;
function emptyLine(): DraftLine {
  return { key: `line-${lineKeySeq++}`, description: '', quantity: '1', unitPrice: '' };
}

function toNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function NewInvoiceModal({ open, onClose }: NewInvoiceModalProps) {
  const queryClient = useQueryClient();
  const { data: cases } = useCaseOptions();

  const [clientName, setClientName] = useState('');
  const [caseId, setCaseId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [gstPercent, setGstPercent] = useState(String(DEFAULT_GST_PERCENT));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const gst = toNumber(gstPercent);
  const { subtotal, gstAmount, total } = useMemo(() => {
    const sub = lines.reduce((sum, l) => sum + toNumber(l.quantity) * toNumber(l.unitPrice), 0);
    const tax = (sub * gst) / 100;
    return { subtotal: sub, gstAmount: tax, total: sub + tax };
  }, [lines, gst]);

  const hasValidLine = lines.some((l) => l.description.trim() && toNumber(l.unitPrice) > 0);

  function reset() {
    setClientName('');
    setCaseId('');
    setDueAt('');
    setGstPercent(String(DEFAULT_GST_PERCENT));
    setLines([emptyLine()]);
  }

  const create = useMutation({
    mutationFn: () =>
      api.post<InvoiceView>('/billing/invoices', {
        clientName: clientName.trim() || undefined,
        caseId: caseId || undefined,
        gstPercent: gst,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        items: lines
          .filter((l) => l.description.trim() && toNumber(l.unitPrice) > 0)
          .map((l) => ({
            description: l.description.trim(),
            quantity: toNumber(l.quantity) || 1,
            unitPrice: toNumber(l.unitPrice),
          })),
      }),
    onSuccess: (invoice) => {
      toast.success(`Invoice ${invoice.number} created`);
      void queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      reset();
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function handleClose() {
    if (create.isPending) return;
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      className="max-w-2xl"
      title="New invoice"
      description="Add line items and we'll calculate GST and the total automatically."
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!hasValidLine}
            onClick={() => create.mutate()}
          >
            Create invoice
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client name" htmlFor="inv-client">
            <Input
              id="inv-client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Sharma & Associates"
            />
          </Field>
          <Field label="Linked case" htmlFor="inv-case">
            <Select id="inv-case" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">No case</option>
              {cases?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Line items</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>

          <div className="space-y-2">
            <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_5rem_7rem_2.25rem]">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit price (₹)</span>
              <span />
            </div>
            {lines.map((line) => {
              const lineTotal = toNumber(line.quantity) * toNumber(line.unitPrice);
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_7rem_2.25rem] sm:items-center"
                >
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    placeholder="Legal services rendered"
                    aria-label="Description"
                  />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    className="sm:text-right"
                    aria-label="Quantity"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                    placeholder="0"
                    className="sm:text-right"
                    aria-label="Unit price"
                  />
                  <div className="flex items-center justify-between sm:justify-center">
                    <span className="text-sm text-muted-foreground sm:hidden">
                      {formatCurrency(lineTotal)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Due date" htmlFor="inv-due">
            <Input
              id="inv-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </Field>
          <Field label="GST %" htmlFor="inv-gst" hint="Default 18% for Indian invoices.">
            <Input
              id="inv-gst"
              type="number"
              min="0"
              max="100"
              step="0.1"
              inputMode="decimal"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <Row label="Subtotal" value={formatCurrency(subtotal)} />
          <Row label={`GST (${gst}%)`} value={formatCurrency(gstAmount)} />
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </Modal>
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
