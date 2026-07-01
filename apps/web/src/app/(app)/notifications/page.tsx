'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import type { NotificationView } from '@anura/shared';
import { api, ApiError, buildQuery } from '@/lib/api-client';
import { Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { NotificationRow } from '@/components/notifications/notification-row';
import { useMarkAllRead } from '@/components/notifications/hooks';

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const markAllRead = useMarkAllRead();

  const query = useQuery({
    queryKey: ['notifications', { unreadOnly }],
    queryFn: () =>
      api.get<NotificationView[]>(
        `/notifications${buildQuery({ unread: unreadOnly ? 'true' : undefined })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const notifications = query.data ?? [];
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );
  const hasUnread = unreadCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Hearing reminders, case updates, and account alerts, all in one place."
        actions={
          <Button
            variant="outline"
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
            disabled={!hasUnread || query.isLoading}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        }
      />

      {/* Toolbar: filter toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterTab active={!unreadOnly} onClick={() => setUnreadOnly(false)}>
          All
        </FilterTab>
        <FilterTab active={unreadOnly} onClick={() => setUnreadOnly(true)}>
          Unread
          {hasUnread && (
            <span
              className={cn(
                'ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                unreadOnly ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary',
              )}
            >
              {unreadCount}
            </span>
          )}
        </FilterTab>
      </div>

      {query.isLoading ? (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-4">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </Card>
      ) : query.isError ? (
        <EmptyState
          icon={Bell}
          title="Couldn't load notifications"
          description={
            query.error instanceof ApiError ? query.error.message : 'Please try again in a moment.'
          }
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={unreadOnly ? BellOff : Bell}
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description={
            unreadOnly
              ? "You're all caught up. New alerts will show up here."
              : "When something needs your attention, like an upcoming hearing, it'll appear here."
          }
          action={
            unreadOnly ? (
              <Button variant="outline" onClick={() => setUnreadOnly(false)}>
                View all
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card
          className={cn(
            'divide-y divide-border overflow-hidden p-0 transition-opacity',
            query.isFetching && 'opacity-70',
          )}
        >
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </Card>
      )}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
