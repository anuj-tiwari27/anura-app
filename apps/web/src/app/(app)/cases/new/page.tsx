'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileSearch, Users } from 'lucide-react';
import { toast } from 'sonner';
import { CasePartyRole, type CaseDetailView, type CnrLookupView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, PageHeader, Spinner } from '@/components/ui';
import { CaseForm, type CaseFormPayload } from '@/components/cases/case-form';
import { CNR_PREFILL_KEY } from '@/components/cases/new-case-modal';

/** Matches the API's CreatePartyDto (subset used by the CNR import). */
interface NewCaseParty {
  name: string;
  role: CasePartyRole;
  advocateName?: string;
}

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

  // Parties fetched from the registry are created together with the case;
  // the form itself only carries the scalar fields.
  const parties = prefill ? prefillToParties(prefill) : [];

  const mutation = useMutation({
    mutationFn: (payload: CaseFormPayload & { parties?: NewCaseParty[] }) =>
      api.post<CaseDetailView>('/cases', payload),
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
            {parties.length > 0 && (
              <p className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                {parties.length} {parties.length === 1 ? 'party' : 'parties'} will be added:{' '}
                {parties.map((p) => p.name).join(', ')}
              </p>
            )}
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
              onSubmit={(payload) =>
                mutation.mutate(parties.length ? { ...payload, parties } : payload)
              }
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
 * Parties are NOT part of the description — they become CaseParty rows
 * via prefillToParties.
 */
function prefillToDefaults(p: CnrLookupView): Partial<CaseDetailView> {
  const lines: string[] = [];
  const caseType = p.caseTypeLabel ?? p.caseTypeRaw;
  if (caseType) lines.push(`Case type: ${caseType}`);
  if (p.decisionDate) lines.push(`Decided on ${p.decisionDate.slice(0, 10)}.`);
  lines.push(`Imported from eCourts by CNR ${p.cnr}.`);

  const clamp = (value: string | null, max: number) =>
    value && value.length > max ? value.slice(0, max) : value;

  return {
    title: clamp(p.title, 300) ?? undefined,
    caseNumber: clamp(p.caseNumber, 120),
    cnr: clamp(p.cnr, 120),
    court: clamp(p.court, 200),
    courtType: p.courtType,
    jurisdiction: clamp(p.jurisdiction, 200),
    practiceArea: p.practiceArea,
    status: p.status ?? undefined,
    filedAt: p.filedAt,
    nextHearingDate: p.nextHearingDate,
    description: clamp(lines.join('\n'), 5000),
  };
}

/**
 * Registry party lists -> CaseParty payloads. The advocate arrays don't
 * reliably parallel the party arrays, so the advocates on record are
 * attached to the first party of each side.
 */
function prefillToParties(p: CnrLookupView): NewCaseParty[] {
  const clampName = (value: string) => presentableName(value).slice(0, 200);
  const toParties = (names: string[], role: CasePartyRole, advocates: string[]): NewCaseParty[] =>
    names.filter(Boolean).map((name, i) => ({
      name: clampName(name),
      role,
      advocateName:
        i === 0 && advocates.length
          ? advocates.map(presentableName).join(', ').slice(0, 200)
          : undefined,
    }));

  return [
    ...toParties(p.petitioners, CasePartyRole.PETITIONER, p.petitionerAdvocates),
    ...toParties(p.respondents, CasePartyRole.RESPONDENT, p.respondentAdvocates),
  ];
}

/** eCourts CIS returns names in ALL CAPS; title-case those, keep mixed case as-is. */
function presentableName(name: string): string {
  const trimmed = name.trim();
  if (/[a-z]/.test(trimmed)) return trimmed;
  return trimmed.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
