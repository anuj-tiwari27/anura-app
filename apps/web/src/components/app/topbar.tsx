'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Menu, Settings } from 'lucide-react';
import { Avatar, Dropdown, DropdownItem } from '@/components/ui';
import { useAuth } from '@/lib/auth-store';
import { NAV_ITEMS } from './nav';

export function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const onLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          <Dropdown
            align="left"
            trigger={
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border">
                <Menu className="h-5 w-5" />
              </span>
            }
          >
            {NAV_ITEMS.map((item) => (
              <DropdownItem key={item.href} onClick={() => router.push(item.href)}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
        <span className="font-display text-lg font-semibold md:hidden">Anura</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </Link>

        <Dropdown trigger={<Avatar name={user?.fullName ?? user?.email} src={user?.avatarUrl} size="sm" />}>
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user?.fullName ?? 'Advocate'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <DropdownItem onClick={() => router.push('/settings')}>
            <Settings className="h-4 w-4" />
            Settings
          </DropdownItem>
          <DropdownItem onClick={onLogout} className="text-destructive">
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
