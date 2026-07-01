'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { CourtType, Labels, PracticeArea, type LawyerProfileView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';

interface FormState {
  fullName: string;
  phone: string;
  barCouncilId: string;
  enrollmentYear: string;
  experienceYears: string;
  primaryCourtType: string;
  city: string;
  state: string;
  bio: string;
  courts: string;
  practiceAreas: PracticeArea[];
}

function toFormState(p: LawyerProfileView): FormState {
  return {
    fullName: p.fullName ?? '',
    phone: p.phone ?? '',
    barCouncilId: p.barCouncilId ?? '',
    enrollmentYear: p.enrollmentYear != null ? String(p.enrollmentYear) : '',
    experienceYears: p.experienceYears != null ? String(p.experienceYears) : '',
    primaryCourtType: p.primaryCourtType ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    bio: p.bio ?? '',
    courts: p.courts.join(', '),
    practiceAreas: p.practiceAreas,
  };
}

export function ProfileTab() {
  const queryClient = useQueryClient();
  const patchUser = useAuth((s) => s.patchUser);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<LawyerProfileView>('/users/profile'),
  });

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (data) setForm(toFormState(data));
  }, [data]);

  const practiceAreaOptions = useMemo(() => Object.values(PracticeArea), []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const toggleArea = (a: PracticeArea) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            practiceAreas: prev.practiceAreas.includes(a)
              ? prev.practiceAreas.filter((x) => x !== a)
              : [...prev.practiceAreas, a],
          }
        : prev,
    );

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<LawyerProfileView>('/users/profile', body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (updated.fullName) patchUser({ fullName: updated.fullName });
      toast.success('Profile saved');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  const save = () => {
    if (!form) return;
    if (!form.fullName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    mutation.mutate({
      fullName: form.fullName.trim(),
      phone: form.phone.trim() || null,
      barCouncilId: form.barCouncilId.trim() || null,
      enrollmentYear: form.enrollmentYear ? Number(form.enrollmentYear) : null,
      experienceYears: form.experienceYears ? Number(form.experienceYears) : null,
      primaryCourtType: form.primaryCourtType || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      bio: form.bio.trim() || null,
      practiceAreas: form.practiceAreas,
      courts: form.courts
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    });
  };

  const reset = () => {
    if (data) setForm(toFormState(data));
  };

  if (isLoading || !form) {
    return (
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-base font-semibold">Couldn't load your profile</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} loading={isFetching}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Professional profile</CardTitle>
          <CardDescription>
            This personalises your drafts, court reminders and case recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
                placeholder="Adv. Ananya Rao"
              />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98xxxxxxxx" />
            </Field>
          </div>

          <Field label="Practice areas">
            <div className="flex flex-wrap gap-2">
              {practiceAreaOptions.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleArea(a)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    form.practiceAreas.includes(a)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {Labels.PracticeArea[a]}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Primary court">
              <Select value={form.primaryCourtType} onChange={(e) => set('primaryCourtType', e.target.value)}>
                <option value="">Select court type</option>
                {Object.values(CourtType).map((c) => (
                  <option key={c} value={c}>
                    {Labels.CourtType[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Years of experience">
              <Input
                type="number"
                min={0}
                value={form.experienceYears}
                onChange={(e) => set('experienceYears', e.target.value)}
                placeholder="8"
              />
            </Field>
            <Field label="Enrollment year">
              <Input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={form.enrollmentYear}
                onChange={(e) => set('enrollmentYear', e.target.value)}
                placeholder="2015"
              />
            </Field>
          </div>

          <Field label="Courts you appear in" hint="Comma separated, e.g. Delhi High Court, Saket District Court">
            <Input
              value={form.courts}
              onChange={(e) => set('courts', e.target.value)}
              placeholder="Delhi High Court, Saket District Court"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bar Council ID">
              <Input
                value={form.barCouncilId}
                onChange={(e) => set('barCouncilId', e.target.value)}
                placeholder="D/1234/2015"
              />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="New Delhi" />
            </Field>
            <Field label="State">
              <Input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="Delhi" />
            </Field>
          </div>

          <Field label="Bio" hint="A short introduction shown on drafts and shared documents.">
            <Textarea
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              rows={4}
              placeholder="Advocate practising in commercial and civil disputes before the Delhi High Court..."
            />
          </Field>
        </CardContent>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={reset} disabled={mutation.isPending}>
            Reset
          </Button>
          <Button onClick={save} loading={mutation.isPending}>
            Save profile
          </Button>
        </div>
      </Card>
    </div>
  );
}
