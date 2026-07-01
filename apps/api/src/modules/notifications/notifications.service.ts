import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import type { NotificationChannel, NotificationType, NotificationView } from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { toNotificationView } from './notifications.mapper';

/** Input for creating a notification from another module. */
export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  channel?: NotificationChannel;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists a user's notifications, newest first, with an optional read/unread filter. */
  async list(userId: string, unread?: boolean): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(unread === undefined ? {} : { read: !unread }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toNotificationView);
  }

  /** Returns the count of the user's unread notifications. */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  /** Marks a single notification read (ownership-checked) and returns it. */
  async markRead(userId: string, id: string): Promise<NotificationView> {
    const existing = await this.findOwned(userId, id);
    if (existing.read) {
      return toNotificationView(existing);
    }
    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { read: true },
    });
    return toNotificationView(updated);
  }

  /** Marks all of a user's unread notifications read. Returns how many were updated. */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { updated: count };
  }

  /** Deletes a notification (ownership-checked). */
  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOwned(userId, id);
    await this.prisma.notification.delete({ where: { id: existing.id } });
  }

  /**
   * Creates a notification for a user. Public API for other modules
   * (cases, billing, whatsapp, etc.) to raise in-app notifications.
   */
  async create(userId: string, input: CreateNotificationInput): Promise<NotificationView> {
    const row = await this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        ...(input.channel ? { channel: input.channel } : {}),
      },
    });
    return toNotificationView(row);
  }

  /** Loads a notification and asserts it belongs to the given user. */
  private async findOwned(userId: string, id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('You do not have access to this notification');
    }
    return notification;
  }
}
