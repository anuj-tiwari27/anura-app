'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Landmark, Search } from 'lucide-react';
import {
  Labels,
  PracticeArea,
  type JudgementView,
  type Paginated,
} from '@anura/shared';
import { api, ApiError, buildQuery } from '@/lib/api-client';
import { Button, EmptyState, Input, Select, Skeleton } from '@/components/ui';
import { JudgementCard } from './judgement-card';

const PAGE_SIZE = 8;

export function SearchJudgements() {
  const [search, setSearch] = useState('');
  const [practiceArea, setPracticeArea] = useState('');
  const [court, setCourt] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['research', 'judgements', { search, practiceArea, court, page }],
    queryFn: () =>
      api.get<Paginated<JudgementView>>(
        `/research/judgements${buildQuery({
          search: search || undefined,
          practiceArea: practiceArea || undefined,
          court: court || undefined,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const results = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const total = query.data?.total ?? 0;
  const hasFilters = search.trim() !== '' || practiceArea !== '' || court.trim() !== '';

  const resetToFirstPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_14rem_14rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
            placeholder="Search judgements by keyword, party or citation…"
            className="pl-9"
            aria-label="Search judgements"
          />
        </div>
        <Select
          value={practiceArea}
          onChange={(e) => resetToFirstPage(setPracticeArea)(e.target.value)}
          aria-label="Filter by practice area"
        >
          <option value="">All practice areas</option>
          {Object.values(PracticeArea).map((pa) => (
            <option key={pa} value={pa}>
              {Labels.PracticeArea[pa]}
            </option>
          ))}
        </Select>
        <Input
          value={court}
          onChange={(e) => resetToFirstPage(setCourt)(e.target.value)}
          placeholder="Filter by court…"
          aria-label="Filter by court"
        />
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={Landmark}
          title="Couldn't load judgements"
          description={
            query.error instanceof ApiError ? query.error.message : 'Please try again in a moment.'
          }
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={hasFilters ? 'No judgements match your search' : 'Search previous judgements'}
          description={
            hasFilters
              ? 'Try broadening your keywords or clearing the practice area and court filters.'
              : 'Look up landmark and reported judgements to strengthen your arguments. Filter by practice area or court to narrow results.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setPracticeArea('');
                  setCourt('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((j) => (
              <JudgementCard key={j.id} judgement={j} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} · {total} judgement{total === 1 ? '' : 's'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || query.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
