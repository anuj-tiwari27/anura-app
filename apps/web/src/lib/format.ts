import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMM yyyy') : fallback;
}

export function formatDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMM yyyy, h:mm a') : fallback;
}

export function fromNow(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : fallback;
}

/** Format INR amounts, e.g. 1499 -> "₹1,499". */
export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}
