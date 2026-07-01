import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Optional accent tone for the icon chip. */
  tone?: 'primary' | 'success' | 'warning' | 'destructive';
  href?: string;
  hint?: string;
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/12 text-destructive',
};

export function StatCard({ label, value, icon: Icon, tone = 'primary', href, hint }: StatCardProps) {
  const body = (
    <Card
      className={cn(
        'flex items-start justify-between gap-4 p-5 transition-shadow',
        href && 'hover:shadow-md',
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
          toneClasses[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {body}
      </Link>
    );
  }
  return body;
}
