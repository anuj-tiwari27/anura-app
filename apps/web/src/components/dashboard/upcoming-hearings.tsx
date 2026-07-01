import Link from 'next/link';
import { CalendarClock, ChevronRight, Gavel } from 'lucide-react';
import type { DashboardSummary } from '@anura/shared';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { formatDate, fromNow } from '@/lib/format';

type Hearing = DashboardSummary['upcomingHearings'][number];

export function UpcomingHearings({ hearings }: { hearings: Hearing[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Upcoming hearings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {hearings.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No hearings scheduled"
            description="Hearings from your active cases will appear here as they approach."
            className="border-0 bg-transparent py-10"
          />
        ) : (
          <ul className="-mt-1 divide-y divide-border/60">
            {hearings.map((h) => {
              const [day, month] = formatDate(h.eventDate, '').split(' ');
              return (
              <li key={`${h.caseId}-${h.eventDate}`}>
                <Link
                  href={`/cases/${h.caseId}`}
                  className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                    <span className="text-[10px] font-medium uppercase leading-none">{month ?? ''}</span>
                    <span className="text-sm font-semibold leading-none">{day ?? ''}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.caseTitle}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {h.court ?? 'Court not set'} · {fromNow(h.eventDate)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
