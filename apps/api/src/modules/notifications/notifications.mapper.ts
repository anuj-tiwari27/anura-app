import type { Notification } from '@prisma/client';
import type { NotificationView } from '@anura/shared';

/** Maps a Prisma Notification row to the shared NotificationView model. */
export function toNotificationView(n: Notification): NotificationView {
  return {
    id: n.id,
    type: n.type,
    channel: n.channel,
    title: n.title,
    body: n.body,
    read: n.read,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
  };
}
