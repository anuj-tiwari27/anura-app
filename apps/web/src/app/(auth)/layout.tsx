'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';

const HIGHLIGHTS = [
  'e-Courts CNR auto-sync & cause lists',
  'AI legal drafting with citation checks',
  'WhatsApp hearing reminders for clients',
  'GST-compliant billing & invoicing',
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { status, user, loadMe } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (useAuth.getState().status === 'idle') void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(user && !user.onboardingComplete ? '/onboarding' : '/dashboard');
    }
  }, [status, user, router]);

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-ink p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-semibold">Anura</span>
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight text-balance">
            The AI-native practice manager for Indian litigators.
          </h1>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-3 text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/50">AES-256 · MFA · DPDPA 2023 · Data resident in India</p>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
