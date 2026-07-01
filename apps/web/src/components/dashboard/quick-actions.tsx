import Link from 'next/link';
import { FilePlus2, Scale, Sparkles, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';

interface Action {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const ACTIONS: Action[] = [
  {
    href: '/cases/new',
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

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="group flex h-full items-center gap-4 p-5 transition-shadow hover:shadow-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <a.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">{a.label}</p>
              <p className="truncate text-xs text-muted-foreground">{a.description}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
