'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/app/sidebar';
import { Topbar } from '@/components/app/topbar';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-store';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user, loadMe } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (useAuth.getState().status === 'idle') void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && user && !user.onboardingComplete) {
      router.replace('/onboarding');
    }
  }, [status, user, router]);

  const ready = status === 'authenticated' && !!user?.onboardingComplete;
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-64">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
