'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Banknote, Briefcase, CalendarClock, FileClock, FilePlus2, RefreshCw } from 'lucide-react';
import type { DashboardSummary } from '@anura/shared';
import { Button, Card, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { formatCurrency } from '@/lib/format';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { NewCaseModal } from '@/components/cases/new-case-modal';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentCases } from '@/components/dashboard/recent-cases';
import { StatCard } from '@/components/dashboard/stat-card';
import { UpcomingHearings } from '@/components/dashboard/upcoming-hearings';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return 'Advocate';
  return fullName.trim().split(/\s+/)[0];
}

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const [newCaseOpen, setNewCaseOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
  });

  useEffect(() => {
    if (error instanceof ApiError && error.status === 503) {
      toast.info('Some services are still warming up. Showing what we can for now.');
    }
  }, [error]);

  const stats = data?.stats;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${firstName(user?.fullName)}`}
        description="Here's what's happening across your practice today."
        actions={
          <Button size="sm" onClick={() => setNewCaseOpen(true)}>
            <FilePlus2 className="h-4 w-4" />
            New case
          </Button>
        }
      />

      <NewCaseModal open={newCaseOpen} onClose={() => setNewCaseOpen(false)} />

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <Card className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-base font-semibold">Couldn't load your dashboard</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} loading={isFetching}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active cases"
              value={stats?.activeCases ?? 0}
              icon={Briefcase}
              tone="primary"
              href="/cases?status=ACTIVE"
            />
            <StatCard
              label="Hearings this week"
              value={stats?.hearingsThisWeek ?? 0}
              icon={CalendarClock}
              tone="success"
              href="/cases"
            />
            <StatCard
              label="Pending documents"
              value={stats?.pendingDocuments ?? 0}
              icon={FileClock}
              tone="warning"
              href="/documents"
            />
            <StatCard
              label="Unpaid invoices"
              value={formatCurrency(stats?.outstandingInvoiceAmount ?? 0)}
              icon={Banknote}
              tone="destructive"
              href="/billing"
              hint="Sent & overdue"
            />
          </div>

          {/* Quick actions */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Quick actions</h2>
            <QuickActions onNewCase={() => setNewCaseOpen(true)} />
          </section>

          {/* Hearings + recent cases */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <UpcomingHearings hearings={data?.upcomingHearings ?? []} />
            </div>
            <div className="lg:col-span-2">
              <RecentCases cases={data?.recentCases ?? []} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
