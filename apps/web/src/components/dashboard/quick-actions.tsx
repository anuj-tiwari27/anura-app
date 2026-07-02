import Link from 'next/link';
import { FilePlus2, Scale, Sparkles, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';

interface Action {
  /** Either a link target or handled via onNewCase for the new-case popup. */
  href?: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const ACTIONS: Action[] = [
  {
    label: 'New case',
    description: 'Open a matter and add parties',
    icon: FilePlus2,
  },
  {
    href: '/assistant',
    label: 'Ask AI',
    description: 'Draft, research, and summarize',
    icon: Sparkles,
  },
  {
    href: '/research',
    label: 'Research',
    description: 'Search judgements & precedents',
    icon: Scale,
  },
];

interface QuickActionsProps {
  /** Opens the new-case modal (fetch-from-CNR vs manual). */
  onNewCase: () => void;
}

export function QuickActions({ onNewCase }: QuickActionsProps) {
  const focusRing =
    'rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {ACTIONS.map((a) =>
        a.href ? (
          <Link key={a.label} href={a.href} className={focusRing}>
            <ActionCard action={a} />
          </Link>
        ) : (
          <button key={a.label} type="button" onClick={onNewCase} className={focusRing}>
            <ActionCard action={a} />
          </button>
        ),
      )}
    </div>
  );
}

function ActionCard({ action }: { action: Action }) {
  return (
    <Card className="group flex h-full items-center gap-4 p-5 transition-shadow hover:shadow-md">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <action.icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-medium">{action.label}</p>
        <p className="truncate text-xs text-muted-foreground">{action.description}</p>
      </div>
    </Card>
  );
}
