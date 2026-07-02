'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import type { CaseDetailView, CnrLookupView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, PageHeader, Spinner } from '@/components/ui';
import { CaseForm, type CaseFormPayload } from '@/components/cases/case-form';
import { CNR_PREFILL_KEY } from '@/components/cases/new-case-modal';

export default function NewCasePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [prefill, setPrefill] = useState<CnrLookupView | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CNR_PREFILL_KEY);
      if (raw) {
        sessionStorage.removeItem(CNR_PREFILL_KEY);
        setPrefill(JSON.parse(raw) as CnrLookupView);
      }
    } catch {
      // Malformed/blocked storage — fall back to an empty form.
    }
    setReady(true);
  }, []);

  const mutation = useMutation({
    mutationFn: (payload: CaseFormPayload) => api.post<CaseDetailView>('/cases', payload),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Case created');
      router.push(`/cases/${created.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/cases"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cases
      </Link>

      <PageHeader title="New case" description="Add a matter to start tracking hearings, parties and documents." />

      {prefill && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">Details fetched from eCourts</p>
            <p className="mt-0.5 text-muted-foreground">
              CNR <span className="font-mono">{prefill.cnr}</span>
              {prefill.statusRaw ? ` · Registry status: ${prefill.statusRaw}` : ''}
              {' — review the fields below and edit anything before saving.'}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          {!ready ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6" />
            </div>
          ) : (
            <CaseForm
              defaultValues={prefill ? prefillToDefaults(prefill) : undefined}
              submitLabel="Create case"
              loading={mutation.isPending}
              onSubmit={(payload) => mutation.mutate(payload)}
              onCancel={() => router.push('/cases')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Map an eCourts CNR lookup onto the CaseForm's defaultValues shape,
 * clamped to the CreateCaseDto max lengths so the POST never 400s.
 */
function prefillToDefaults(p: CnrLookupView): Partial<CaseDetailView> {
  const lines: string[] = [];
  if (p.petitioners.length) lines.push(`Petitioners: ${p.petitioners.join(', ')}`);
  if (p.respondents.length) lines.push(`Respondents: ${p.respondents.join(', ')}`);
  if (p.petitionerAdvocates.length) lines.push(`Petitioner advocates: ${p.petitionerAdvocates.join(', ')}`);
  if (p.respondentAdvocates.length) lines.push(`Respondent advocates: ${p.respondentAdvocates.join(', ')}`);
  if (p.caseTypeRaw) lines.push(`Case type: ${p.caseTypeRaw}`);
  lines.push(`Imported from eCourts by CNR ${p.cnr}.`);

  const clamp = (value: string | null, max: number) =>
    value && value.length > max ? value.slice(0, max) : value;

  return {
    title: clamp(p.title, 300) ?? undefined,
    caseNumber: clamp(p.caseNumber, 120),
    cnr: clamp(p.cnr, 120),
    court: clamp(p.court, 200),
    courtType: p.courtType,
    status: p.status ?? undefined,
    filedAt: p.filedAt,
    nextHearingDate: p.nextHearingDate,
    description: clamp(lines.join('\n'), 5000),
  };
}
