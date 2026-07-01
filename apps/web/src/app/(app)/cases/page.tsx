'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Briefcase, Plus, Search } from 'lucide-react';
import {
  CaseStatus,
  Labels,
  type CaseSummaryView,
  type Paginated,
} from '@anura/shared';
import { api, buildQuery } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
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

const PAGE_SIZE = 10;

export default function CasesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['cases', { page, search, status }],
    queryFn: () =>
      api.get<Paginated<CaseSummaryView>>(
        `/cases${buildQuery({ page, pageSize: PAGE_SIZE, search: search || undefined, status: status || undefined })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const cases = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const hasFilters = search.trim() !== '' || status !== '';

  const resetPageThen = (fn: () => void) => {
    setPage(1);
    fn();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cases"
        description="Every matter you are handling, in one place."
        actions={
          <Button onClick={() => router.push('/cases/new')}>
            <Plus className="h-4 w-4" />
            New case
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => resetPageThen(() => setSearch(e.target.value))}
            placeholder="Search by title, number, client or CNR"
            className="pl-9"
          />
        </div>
        <div className="sm:w-56">
          <Select value={status} onChange={(e) => resetPageThen(() => setStatus(e.target.value))}>
            <option value="">All statuses</option>
            {Object.values(CaseStatus).map((s) => (
              <option key={s} value={s}>
                {Labels.CaseStatus[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <CasesTableSkeleton />
      ) : isError ? (
        <EmptyState
          icon={Briefcase}
          title="Could not load cases"
          description="Something went wrong while fetching your cases. Please try again."
        />
      ) : cases.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={hasFilters ? 'No cases match your filters' : 'No cases yet'}
          description={
            hasFilters
              ? 'Try adjusting your search or status filter.'
              : 'Create your first case to start tracking hearings, parties and documents.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() =>
                  resetPageThen(() => {
                    setSearch('');
                    setStatus('');
                  })
                }
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => router.push('/cases/new')}>
                <Plus className="h-4 w-4" />
                New case
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH className="hidden md:table-cell">Court</TH>
                <TH>Status</TH>
                <TH className="hidden sm:table-cell">Next hearing</TH>
                <TH className="hidden lg:table-cell">Client</TH>
              </TR>
            </THead>
            <TBody>
              {cases.map((c) => (
                <TR
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/cases/${c.id}`)}
                >
                  <TD>
                    <div className="font-medium text-foreground">{c.title}</div>
                    {c.caseNumber && (
                      <div className="text-xs text-muted-foreground">{c.caseNumber}</div>
                    )}
                  </TD>
                  <TD className="hidden text-muted-foreground md:table-cell">
                    {c.court ?? (c.courtType ? Labels.CourtType[c.courtType] : '—')}
                  </TD>
                  <TD>
                    <StatusBadge kind="case" value={c.status} />
                  </TD>
                  <TD className="hidden text-muted-foreground sm:table-cell">
                    {formatDate(c.nextHearingDate)}
                  </TD>
                  <TD className="hidden text-muted-foreground lg:table-cell">
                    {c.clientName ?? '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {data?.page ?? page} of {totalPages}
                {typeof data?.total === 'number' && (
                  <span className="hidden sm:inline"> · {data.total} cases</span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isPlaceholderData}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isPlaceholderData}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CasesTableSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="hidden h-5 w-40 md:block" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="hidden h-5 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}
