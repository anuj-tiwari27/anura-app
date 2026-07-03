'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AuthResponse } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

interface GoogleButtonProps {
  /** Picks the Google button label: "Sign in with Google" vs "Sign up with Google". */
  context?: 'signin' | 'signup';
}

/**
 * "Continue with Google" via Google Identity Services.
 * Renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured, so the
 * email/password flow keeps working standalone.
 */
export function GoogleButton({ context = 'signin' }: GoogleButtonProps) {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const slotRef = React.useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const slot = slotRef.current;
    if (!slot) return;

    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            const res = await api.post<AuthResponse>(
              '/auth/google',
              { idToken: credential },
              { auth: false },
            );
            setSession(res);
            toast.success('Welcome to Anura');
            router.replace(res.user.onboardingComplete ? '/dashboard' : '/onboarding');
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : 'Google sign-in failed');
          }
        },
      });
      window.google.accounts.id.renderButton(slot, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        logo_alignment: 'left',
        text: context === 'signup' ? 'signup_with' : 'signin_with',
        width: Math.min(slot.offsetWidth || 320, 400),
      });
      setReady(true);
    };

    if (window.google) {
      init();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = GSI_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', init);
      return () => {
        cancelled = true;
        script?.removeEventListener('load', init);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [context, router, setSession]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="mt-6">
      <div ref={slotRef} className={ready ? 'flex justify-center' : 'h-10'} />
      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
