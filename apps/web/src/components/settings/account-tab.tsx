'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, ShieldCheck } from 'lucide-react';
import type { PublicUser } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { formatDate } from '@/lib/format';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '@/components/ui';

export function AccountTab() {
  const { user, patchUser } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user?.fullName ?? '');

  useEffect(() => {
    setFullName(user?.fullName ?? '');
  }, [user?.fullName]);

  const mutation = useMutation({
    mutationFn: (body: { fullName: string }) => api.patch<PublicUser>('/users/me', body),
    onSuccess: (updated) => {
      patchUser(updated);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Display name updated');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  const trimmed = fullName.trim();
  const dirty = trimmed !== (user?.fullName ?? '').trim();

  const save = () => {
    if (!trimmed) {
      toast.error('Please enter a display name');
      return;
    }
    mutation.mutate({ fullName: trimmed });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage the login identity for your Anura workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={user?.fullName ?? user?.email} src={user?.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-medium">{user?.fullName || 'Unnamed advocate'}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              {user?.createdAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Member since {formatDate(user.createdAt)}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adv. Ananya Rao"
              />
            </Field>
            <Field label="Email address" hint="Contact support to change the email on your account.">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={user?.email ?? ''} disabled className="pl-9" />
              </div>
            </Field>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} loading={mutation.isPending} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Your session and sign-in options.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p className="font-medium">Email and one-time passcode sign-in</p>
              <p className="mt-0.5 text-muted-foreground">
                You sign in with your password or a one-time passcode sent to {user?.email ?? 'your email'}.
                Passwordless login keeps your account protected without shared credentials.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
