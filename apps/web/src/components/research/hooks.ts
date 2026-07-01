'use client';

import { useQuery } from '@tanstack/react-query';
import type { CaseSummaryView, Paginated } from '@anura/shared';
import { api, buildQuery } from '@/lib/api-client';

/**
 * Fetch cases (up to 100) to populate the "find similar to case" select.
 * Cached and shared with the rest of the app under the ['cases', 'options'] key.
 */
export function useCaseOptions() {
  return useQuery({
    queryKey: ['cases', 'options'],
    queryFn: () => api.get<Paginated<CaseSummaryView>>(`/cases${buildQuery({ pageSize: 100 })}`),
    staleTime: 60_000,
    select: (data) => data.items,
  });
}
