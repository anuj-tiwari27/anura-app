'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { NotificationView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

/** Invalidate both the list and the unread-count badge (topbar) after a change. */
function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  };
}

export function useMarkRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => api.post<NotificationView>(`/notifications/${id}/read`),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>('/notifications/read-all'),
    onSuccess: (res) => {
      invalidate();
      toast.success(
        res.updated > 0
          ? `Marked ${res.updated} notification${res.updated === 1 ? '' : 's'} as read`
          : 'All caught up',
      );
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export function useDeleteNotification() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/notifications/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Notification removed');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
