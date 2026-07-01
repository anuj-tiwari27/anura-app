'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info, Sparkles, Telescope } from 'lucide-react';
import {
  Labels,
  PracticeArea,
  type SimilarCaseView,
} from '@anura/shared';
import { api, ApiError, buildQuery } from '@/lib/api-client';
import { Button, Card, EmptyState, Field, Select, Skeleton, Textarea } from '@/components/ui';
import { useCaseOptions } from './hooks';
import { JudgementCard } from './judgement-card';

type Mode = 'case' | 'text';

const AI_UNCONFIGURED =
  'Semantic search is not configured yet. Add your AI provider key to enable finding similar judgements.';

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 503 ? AI_UNCONFIGURED : err.message;
  }
  return 'Something went wrong';
}

export function FindSimilar() {
  const [mode, setMode] = useState<Mode>('case');
  const [caseId, setCaseId] = useState('');
  const [text, setText] = useState('');
  const [practiceArea, setPracticeArea] = useState('');
  const [textResults, setTextResults] = useState<SimilarCaseView[] | null>(null);

  const { data: cases, isLoading: casesLoading } = useCaseOptions();

  const caseQuery = useQuery({
    queryKey: ['research', 'similar', 'case', caseId],
    queryFn: () =>
      api.get<SimilarCaseView[]>(`/research/similar${buildQuery({ caseId })}`),
    enabled: mode === 'case' && caseId !== '',
    retry: false,
  });

  const textMutation = useMutation({
    mutationFn: (body: { text: string; practiceArea?: string }) =>
      api.post<SimilarCaseView[]>('/research/similar', body),
    onSuccess: (data) => {
      setTextResults(data);
      if (data.length === 0) {
        toast.info('No similar judgements found. Try adding more detail or reindexing.');
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const runTextSearch = () => {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      toast.error('Add a little more detail (at least 10 characters) to find similar judgements.');
      return;
    }
    textMutation.mutate({ text: trimmed, practiceArea: practiceArea || undefined });
  };

  const caseError =
    caseQuery.isError && caseQuery.error instanceof ApiError && caseQuery.error.status === 503;

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {(
          [
            { value: 'case', label: 'From a case' },
            { value: 'text', label: 'From a description' },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setMode(t.value)}
            className={
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
              (mode === t.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Similarity is powered by semantic search over indexed judgements. Results improve as more
        judgements are indexed into the research corpus.
      </p>

      {mode === 'case' ? (
        <Card className="p-5">
          <Field
            label="Find judgements similar to a case"
            hint="We match on the case's facts, practice area and court to surface relevant precedent."
          >
            <div className="sm:max-w-md">
              <Select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                aria-label="Select a case"
                disabled={casesLoading}
              >
                <option value="">
                  {casesLoading ? 'Loading cases…' : 'Select a case…'}
                </option>
                {cases?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.caseNumber ? ` (${c.caseNumber})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        </Card>
      ) : (
        <Card className="p-5">
          <Field
            label="Describe the matter or legal question"
            hint="Paste facts, a legal issue, or a paragraph from your draft to find on-point precedent."
          >
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Dispute over specific performance of an agreement to sell immovable property where the buyer was ready and willing to perform…"
              rows={5}
            />
          </Field>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Field label="Practice area (optional)" className="sm:w-64">
              <Select
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
                aria-label="Practice area"
              >
                <option value="">Any practice area</option>
                {Object.values(PracticeArea).map((pa) => (
                  <option key={pa} value={pa}>
                    {Labels.PracticeArea[pa]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={runTextSearch} loading={textMutation.isPending}>
              <Sparkles className="h-4 w-4" />
              Find similar
            </Button>
          </div>
        </Card>
      )}

      {mode === 'case'
        ? renderCaseResults()
        : renderTextResults()}
    </div>
  );

  function renderCaseResults() {
    if (caseId === '') {
      return (
        <EmptyState
          icon={Telescope}
          title="Pick a case to begin"
          description="Choose one of your cases above and we'll rank the most similar judgements from the research corpus."
        />
      );
    }
    if (caseQuery.isLoading) return <ResultsSkeleton />;
    if (caseError) {
      return (
        <EmptyState icon={Telescope} title="Semantic search unavailable" description={AI_UNCONFIGURED} />
      );
    }
    if (caseQuery.isError) {
      return (
        <EmptyState
          icon={Telescope}
          title="Couldn't find similar judgements"
          description={errorMessage(caseQuery.error)}
          action={
            <Button variant="outline" onClick={() => caseQuery.refetch()}>
              Retry
            </Button>
          }
        />
      );
    }
    return <RankedResults results={caseQuery.data ?? []} />;
  }

  function renderTextResults() {
    if (textMutation.isPending) return <ResultsSkeleton />;
    if (textResults === null) {
      return (
        <EmptyState
          icon={Telescope}
          title="Describe a matter to find precedent"
          description="Enter the facts or legal question above and run the search to see ranked, on-point judgements."
        />
      );
    }
    return <RankedResults results={textResults} />;
  }
}

function RankedResults({ results }: { results: SimilarCaseView[] }) {
  if (results.length === 0) {
    return (
      <EmptyState
        icon={Telescope}
        title="No similar judgements yet"
        description="Nothing matched closely. Similarity improves once more judgements are indexed into the research corpus."
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {results.map((r, i) => (
        <JudgementCard key={r.id} judgement={r} score={r.score} rank={i + 1} />
      ))}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}
