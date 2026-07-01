'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  AIChatView,
  CaseSummaryView,
  DraftView,
  Paginated,
} from '@anura/shared';
import { api, buildQuery } from '@/lib/api-client';

/** All chat threads for the current lawyer (list pane). */
export function useChats() {
  return useQuery({
    queryKey: ['ai', 'chats'],
    queryFn: () => api.get<AIChatView[]>('/ai/chats'),
  });
}

/** A single chat with its messages (right pane). */
export function useChat(chatId: string | null) {
  return useQuery({
    queryKey: ['ai', 'chat', chatId],
    queryFn: () => api.get<AIChatView>(`/ai/chats/${chatId}`),
    enabled: !!chatId,
  });
}

/** Recent drafts for the Draft mode side list. */
export function useDrafts(caseId?: string) {
  return useQuery({
    queryKey: ['ai', 'drafts', caseId ?? null],
    queryFn: () => api.get<DraftView[]>(`/ai/drafts${buildQuery({ caseId })}`),
  });
}

/**
 * Up to 100 cases to populate the "attach to case" selects in both modes.
 * Shared with the documents feature's query key so it stays warm in cache.
 */
export function useCaseOptions() {
  return useQuery({
    queryKey: ['cases', 'options'],
    queryFn: () => api.get<Paginated<CaseSummaryView>>(`/cases${buildQuery({ pageSize: 100 })}`),
    staleTime: 60_000,
    select: (data) => data.items,
  });
}
