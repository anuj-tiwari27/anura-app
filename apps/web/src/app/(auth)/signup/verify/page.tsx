'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MailCheck } from 'lucide-react';
import type { AuthResponse } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Button, Field, Input } from '@/components/ui';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Step 2 of signup: confirm ownership of the email address with the 6-digit
 * code. Tokens are only issued here, so an unverified address can never reach
 * the app.
 */
export default function VerifySignupPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read the address from the query string without useSearchParams, which would
  // force a Suspense boundary for static prerendering.
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('email');
    if (fromQuery) setEmail(fromQuery);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (value: string) => {
    if (!email) {
      toast.error('Missing email address — please sign up again');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<AuthResponse>(
        '/auth/signup/verify',
        { email, code: value },
        { auth: false },
      );
      setSession(res);
      toast.success('Email verified');
      // Profile setup first, then plan selection (see /onboarding -> /plan).
      router.replace('/onboarding');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not verify that code');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.post('/auth/signup/resend', { email }, { auth: false });
      toast.success('We sent you a new code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not resend the code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="h-5 w-5" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold">Verify your email</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We sent a 6-digit code to{' '}
        <span className="font-medium text-foreground">{email || 'your email'}</span>. Enter it below
        to finish creating your account.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
        className="mt-8 space-y-4"
      >
        <Field label="Verification code" htmlFor="code">
          <Input
            id="code"
            ref={inputRef}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            className="text-center text-lg font-semibold tracking-[0.4em]"
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(next);
              // Submit as soon as the code is complete — no extra click needed.
              if (next.length === 6 && !submitting) void verify(next);
            }}
          />
        </Field>

        <Button type="submit" className="w-full" loading={submitting} disabled={code.length !== 6}>
          Verify and continue
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Didn&apos;t get it?{' '}
        <button
          type="button"
          onClick={resend}
          disabled={resending || cooldown > 0 || !email}
          className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>

      <p className="mt-2 text-center text-sm text-muted-foreground">
        Wrong address?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Start over
        </Link>
      </p>
    </div>
  );
}
