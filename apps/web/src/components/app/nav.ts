import {
  Bell,
  Briefcase,
  FileText,
  LayoutDashboard,
  Receipt,
  Scale,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cases', label: 'Cases', icon: Briefcase },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { href: '/research', label: 'Research', icon: Scale },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];
