import {
  Bell,
  Briefcase,
  CalendarClock,
  FileCheck2,
  Receipt,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { NotificationType } from '@anura/shared';
import type { BadgeProps } from '@/components/ui';

interface NotificationMeta {
  label: string;
  icon: LucideIcon;
  variant: NonNullable<BadgeProps['variant']>;
}

const META: Record<NotificationType, NotificationMeta> = {
  [NotificationType.CASE_UPDATE]: { label: 'Case update', icon: Briefcase, variant: 'default' },
  [NotificationType.HEARING_REMINDER]: {
    label: 'Hearing',
    icon: CalendarClock,
    variant: 'warning',
  },
  [NotificationType.DOCUMENT_READY]: {
    label: 'Document',
    icon: FileCheck2,
    variant: 'success',
  },
  [NotificationType.INVOICE]: { label: 'Invoice', icon: Receipt, variant: 'secondary' },
  [NotificationType.SYSTEM]: { label: 'System', icon: Settings, variant: 'muted' },
};

const FALLBACK: NotificationMeta = { label: 'Notification', icon: Bell, variant: 'muted' };

export function notificationMeta(type: NotificationType): NotificationMeta {
  return META[type] ?? FALLBACK;
}
