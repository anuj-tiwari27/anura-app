'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, Trash2 } from 'lucide-react';
import type { NotificationView } from '@anura/shared';
import { Badge, Button } from '@/components/ui';
import { fromNow } from '@/lib/format';
import { cn } from '@/lib/utils';
import { notificationMeta } from './notification-meta';
import { useDeleteNotification, useMarkRead } from './hooks';

interface NotificationRowProps {
  notification: NotificationView;
}

export function NotificationRow({ notification }: NotificationRowProps) {
  const router = useRouter();
  const markRead = useMarkRead();
  const deleteNotification = useDeleteNotification();

  const meta = notificationMeta(notification.type);
  const Icon = meta.icon;
  const isUnread = !notification.read;
  const hasLink = !!notification.link;

  function openNotification() {
    if (!notification.link) return;
    if (isUnread) markRead.mutate(notification.id);
    router.push(notification.link);
  }

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-4 py-4 transition-colors sm:px-5',
        isUnread ? 'bg-primary/[0.04]' : 'bg-card',
        hasLink && 'cursor-pointer hover:bg-muted/60',
      )}
      role={hasLink ? 'button' : undefined}
      tabIndex={hasLink ? 0 : undefined}
      onClick={hasLink ? openNotification : undefined}
      onKeyDown={
        hasLink
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openNotification();
              }
            }
          : undefined
      }
    >
      {/* Unread accent dot */}
      <span className="mt-2 flex w-2 shrink-0 justify-center" aria-hidden>
        {isUnread && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>

      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          isUnread ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn('text-sm', isUnread ? 'font-semibold' : 'font-medium')}>
            {notification.title}
          </p>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {hasLink && (
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
        {notification.body && (
          <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">{fromNow(notification.createdAt)}</p>
      </div>

      {/* Actions — stopPropagation so they don't trigger row navigation */}
      <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        {isUnread && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mark as read"
            title="Mark as read"
            loading={markRead.isPending}
            onClick={() => markRead.mutate(notification.id)}
            className="text-muted-foreground hover:text-primary"
          >
            {!markRead.isPending && <Check className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete notification"
          title="Delete"
          loading={deleteNotification.isPending}
          onClick={() => deleteNotification.mutate(notification.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          {!deleteNotification.isPending && <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
