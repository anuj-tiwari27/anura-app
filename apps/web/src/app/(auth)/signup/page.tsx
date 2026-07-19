'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { SignupResult } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button, Field, Input } from '@/components/ui';
import { GoogleButton } from '@/components/auth/google-button';

const schema = z.object({
  fullName: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      // Signup returns no tokens — the account is created unverified and a
      // one-time code is emailed. The verify screen completes the sign-in.
      const res = await api.post<SignupResult>('/auth/signup', values, { auth: false });
      toast.success('Check your email for a 6-digit code');
      router.push(`/signup/verify?email=${encodeURIComponent(res.email)}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Unable to create account');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Start managing cases in minutes.</p>

      <GoogleButton context="signup" />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <Input id="fullName" placeholder="Adv. Ananya Rao" autoComplete="name" {...register('fullName')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" placeholder="you@chambers.in" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters">
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
