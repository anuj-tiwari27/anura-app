import {
  Labels,
  type CaseStatus,
  type DocumentStatus,
  type InvoiceStatus,
  type SubscriptionStatus,
} from '@anura/shared';
import { Badge, type BadgeProps } from './badge';

type Variant = NonNullable<BadgeProps['variant']>;

const caseVariant: Record<CaseStatus, Variant> = {
  DRAFT: 'muted',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  DISPOSED: 'secondary',
  ARCHIVED: 'muted',
};

const documentVariant: Record<DocumentStatus, Variant> = {
  UPLOADED: 'muted',
  PROCESSING: 'warning',
  OCR_DONE: 'default',
  INDEXED: 'success',
  FAILED: 'destructive',
  ARCHIVED: 'secondary',
};

const invoiceVariant: Record<InvoiceStatus, Variant> = {
  DRAFT: 'muted',
  SENT: 'default',
  PAID: 'success',
  OVERDUE: 'destructive',
  CANCELLED: 'secondary',
};

const subscriptionVariant: Record<SubscriptionStatus, Variant> = {
  TRIALING: 'default',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  CANCELLED: 'destructive',
};

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface StatusBadgeProps {
  kind: 'case' | 'document' | 'invoice' | 'subscription';
  value: string;
}

export function StatusBadge({ kind, value }: StatusBadgeProps) {
  let variant: Variant = 'muted';
  let label = humanize(value);

  if (kind === 'case') {
    variant = caseVariant[value as CaseStatus] ?? 'muted';
    label = Labels.CaseStatus[value as CaseStatus] ?? label;
  } else if (kind === 'document') {
    variant = documentVariant[value as DocumentStatus] ?? 'muted';
    label = Labels.DocumentStatus[value as DocumentStatus] ?? label;
  } else if (kind === 'invoice') {
    variant = invoiceVariant[value as InvoiceStatus] ?? 'muted';
    label = Labels.InvoiceStatus[value as InvoiceStatus] ?? label;
  } else if (kind === 'subscription') {
    variant = subscriptionVariant[value as SubscriptionStatus] ?? 'muted';
  }

  return <Badge variant={variant}>{label}</Badge>;
}
