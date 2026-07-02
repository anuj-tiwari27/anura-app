'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-store';
import { Avatar } from '@/components/ui';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <span className="font-display text-xl font-semibold tracking-tight">Anura</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Beta
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted"
            title="Account settings"
          >
            <Avatar name={user?.fullName ?? user?.email} src={user?.avatarUrl} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {user?.fullName ?? 'Advocate'}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email ?? '—'}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
