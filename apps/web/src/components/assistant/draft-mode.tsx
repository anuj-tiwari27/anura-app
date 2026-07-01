'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  Copy,
  Download,
  FileSignature,
  History,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { TemplateType, type DraftView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { fromNow } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Select,
  Skeleton,
  Spinner,
  Textarea,
} from '@/components/ui';
import { CitationChips } from './citation-chips';
import { useCaseOptions, useDrafts } from './hooks';

const AI_NOT_CONFIGURED = "AI isn't configured yet — add OPENAI/ANTHROPIC key to .env";

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  PETITION: 'Petition',
  NOTICE: 'Legal notice',
  AGREEMENT: 'Agreement',
  AFFIDAVIT: 'Affidavit',
  REPLY: 'Reply / Rejoinder',
  OTHER: 'Other',
};

function errMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 503) return AI_NOT_CONFIGURED;
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'anura-draft'
  );
}

export function DraftMode() {
  const qc = useQueryClient();
  const { data: cases } = useCaseOptions();
  const draftsQuery = useDrafts();

  const [prompt, setPrompt] = useState('');
  const [caseId, setCaseId] = useState('');
  const [templateType, setTemplateType] = useState('');

  const [active, setActive] = useState<DraftView | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync the editable textarea whenever a new/selected draft becomes active.
  useEffect(() => {
    setEditedContent(active?.content ?? '');
  }, [active]);

  const generate = useMutation({
    mutationFn: () =>
      api.post<DraftView>('/ai/draft', {
        prompt: prompt.trim(),
        caseId: caseId || undefined,
        templateType: templateType || undefined,
      }),
    onSuccess: (draft) => {
      setActive(draft);
      qc.setQueryData<DraftView[]>(['ai', 'drafts', null], (prev) => [
        draft,
        ...(prev ?? []).filter((d) => d.id !== draft.id),
      ]);
      qc.invalidateQueries({ queryKey: ['ai', 'drafts'] });
      toast.success('Draft ready');
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const canGenerate = prompt.trim().length > 0 && !generate.isPending;

  const downloadDraft = () => {
    if (!active) return;
    const blob = new Blob([editedContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(active.title)}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Draft downloaded');
  };

  const copyDraft = async () => {
    if (!editedContent) return;
    try {
      await navigator.clipboard.writeText(editedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const drafts = draftsQuery.data ?? [];
  const isDirty = useMemo(
    () => !!active && editedContent !== active.content,
    [active, editedContent],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-6">
        {/* Prompt form */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Generate a draft
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="What do you need drafted?" required>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the draft you need… e.g. A legal notice to a tenant for arrears of rent of ₹1,20,000 over four months, demanding payment within 15 days and vacation of the premises."
                className="min-h-[120px] resize-y"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Attach to case" hint="Gives the draft relevant context.">
                <Select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                  <option value="">No case</option>
                  {cases?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Document type">
                <Select value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
                  <option value="">Auto-detect</option>
                  {Object.values(TemplateType).map((t) => (
                    <option key={t} value={t}>
                      {TEMPLATE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => generate.mutate()} disabled={!canGenerate} loading={generate.isPending}>
                {!generate.isPending && <Sparkles className="h-4 w-4" />}
                Generate draft
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output */}
        {generate.isPending ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Spinner className="h-7 w-7" />
              <div>
                <p className="text-sm font-medium text-foreground">Drafting your document…</p>
                <p className="text-xs text-muted-foreground">
                  Anura is researching and composing. This can take a few seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : active ? (
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-4">
              <div className="min-w-0">
                <CardTitle className="truncate">{active.title}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {active.templateType
                    ? TEMPLATE_LABELS[active.templateType] ?? active.templateType
                    : 'Generated draft'}{' '}
                  · {fromNow(active.createdAt)}
                  {isDirty && <span className="ml-2 text-primary">· edited</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyDraft}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" onClick={downloadDraft}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[420px] resize-y font-serif text-[13px] leading-relaxed"
                spellCheck
              />
              {active.citations && active.citations.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Authorities cited
                  </p>
                  <CitationChips citations={active.citations} />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileSignature className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">No draft yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Describe what you need above and hit Generate. Your draft appears here, fully
                editable, with the authorities it relied on.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent drafts */}
      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Recent drafts</h3>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-2">
            {draftsQuery.isLoading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : drafts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Drafts you generate will be saved here.
              </p>
            ) : (
              <ul className="space-y-1">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setActive(d)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                        active?.id === d.id
                          ? 'border-border bg-muted'
                          : 'border-transparent hover:bg-muted/60',
                      )}
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {d.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {d.templateType
                          ? `${TEMPLATE_LABELS[d.templateType] ?? d.templateType} · `
                          : ''}
                        {fromNow(d.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}
