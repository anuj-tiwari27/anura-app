'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CourtType, Labels, PracticeArea, type PublicUser } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { Button, Card, CardContent, Field, Input, Select, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function OnboardingPage() {
  const router = useRouter();
  const { status, user, loadMe, patchUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [barCouncilId, setBarCouncilId] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [primaryCourtType, setPrimaryCourtType] = useState<string>('');
  const [courts, setCourts] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [areas, setAreas] = useState<PracticeArea[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Set while we navigate on to plan selection. Saving marks the user
  // onboardingComplete, which would otherwise make the guard below fire and
  // bounce them to /dashboard, skipping the plan step entirely.
  const finishing = useRef(false);

  useEffect(() => {
    if (useAuth.getState().status === 'idle') void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (!finishing.current && status === 'authenticated' && user?.onboardingComplete) {
      router.replace('/dashboard');
    }
    if (status === 'authenticated' && user && !fullName) setFullName(user.fullName ?? '');
  }, [status, user, router, fullName]);

  const practiceAreaOptions = useMemo(() => Object.values(PracticeArea), []);

  const toggleArea = (a: PracticeArea) =>
    setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const submit = async (skip: boolean) => {
    if (!fullName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    setSubmitting(true);
    try {
      const payload = skip
        ? { fullName, skip: true }
        : {
            fullName,
            phone: phone || undefined,
            barCouncilId: barCouncilId || undefined,
            experienceYears: experienceYears ? Number(experienceYears) : undefined,
            primaryCourtType: primaryCourtType || undefined,
            courts: courts
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean),
            city: city || undefined,
            state: state || undefined,
            practiceAreas: areas,
          };
      const updated = await api.post<PublicUser>('/users/onboarding', payload);
      finishing.current = true;
      patchUser(updated);
      toast.success('Profile saved — last step');
      router.replace('/plan');
    } catch (e) {
      finishing.current = false;
      toast.error(e instanceof ApiError ? e.message : 'Could not save your details');
    } finally {
      setSubmitting(false);
    }
  };

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <span className="font-display text-2xl font-semibold">Anura</span>
          <h1 className="mt-4 font-display text-3xl font-semibold">Tell us about your practice</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This personalises your drafts, court reminders and case recommendations. You can skip and do it later.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Adv. Ananya Rao" />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxx" />
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
                      areas.includes(a)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    {Labels.PracticeArea[a]}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary court">
                <Select value={primaryCourtType} onChange={(e) => setPrimaryCourtType(e.target.value)}>
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
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="8"
                />
              </Field>
            </div>

            <Field label="Courts you appear in" hint="Comma separated, e.g. Delhi High Court, Saket District Court">
              <Input value={courts} onChange={(e) => setCourts(e.target.value)} placeholder="Delhi High Court, Saket District Court" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Bar Council ID">
                <Input value={barCouncilId} onChange={(e) => setBarCouncilId(e.target.value)} placeholder="D/1234/2015" />
              </Field>
              <Field label="City">
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="New Delhi" />
              </Field>
              <Field label="State">
                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Delhi" />
              </Field>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => submit(true)} disabled={submitting}>
                Skip for now
              </Button>
              <Button onClick={() => submit(false)} loading={submitting}>
                Finish setup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
