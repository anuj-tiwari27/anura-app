'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CaseStatus,
  Labels,
  type CaseDetailView,
  type CaseNoteView,
  type CasePartyView,
  type DocumentView,
  type Paginated,
  type TimelineEventView,
} from '@anura/shared';
import { api, ApiError, buildQuery } from '@/lib/api-client';
import { formatDate, fromNow } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Dropdown,
  DropdownItem,
  Modal,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  type TabItem,
} from '@/components/ui';
import { CaseForm, type CaseFormPayload } from '@/components/cases/case-form';
import { PartyModal, type PartyPayload } from '@/components/cases/party-modal';
import { AddTimelineModal, type TimelinePayload } from '@/components/cases/add-timeline-modal';

type TabKey = 'overview' | 'timeline' | 'notes' | 'documents';

const TABS: TabItem[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'notes', label: 'Notes' },
  { value: 'documents', label: 'Documents' },
];

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');

  const caseKey = ['case', id] as const;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: caseKey });

  const { data: caseData, isLoading, isError, error } = useQuery({
    queryKey: caseKey,
    queryFn: () => api.get<CaseDetailView>(`/cases/${id}`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

  // --- Mutations ------------------------------------------------------------

  const editMutation = useMutation({
    mutationFn: (payload: CaseFormPayload) => api.patch<CaseDetailView>(`/cases/${id}`, payload),
    onSuccess: () => {
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Case updated');
      setEditOpen(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: CaseStatus) => api.patch<CaseDetailView>(`/cases/${id}`, { status }),
    onSuccess: (updated) => {
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      toast.success(`Case moved to ${Labels.CaseStatus[updated.status]}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const addPartyMutation = useMutation({
    mutationFn: (payload: PartyPayload) => api.post<CasePartyView>(`/cases/${id}/parties`, payload),
    onSuccess: () => {
      void invalidate();
      toast.success('Party added');
      setPartyOpen(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const removePartyMutation = useMutation({
    mutationFn: (partyId: string) => api.delete<void>(`/cases/${id}/parties/${partyId}`),
    onSuccess: () => {
      void invalidate();
      toast.success('Party removed');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const addTimelineMutation = useMutation({
    mutationFn: (payload: TimelinePayload) => api.post<TimelineEventView>(`/cases/${id}/timeline`, payload),
    onSuccess: () => {
      void invalidate();
      toast.success('Event added');
      setTimelineOpen(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const removeTimelineMutation = useMutation({
    mutationFn: (eventId: string) => api.delete<void>(`/cases/${id}/timeline/${eventId}`),
    onSuccess: () => {
      void invalidate();
      toast.success('Event removed');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const addNoteMutation = useMutation({
    mutationFn: (body: string) => api.post<CaseNoteView>(`/cases/${id}/notes`, { body }),
    onSuccess: () => {
      void invalidate();
      setNoteBody('');
      toast.success('Note added');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const removeNoteMutation = useMutation({
    mutationFn: (noteId: string) => api.delete<void>(`/cases/${id}/notes/${noteId}`),
    onSuccess: () => {
      void invalidate();
      toast.success('Note removed');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  // --- States ---------------------------------------------------------------

  if (isLoading) return <CaseDetailSkeleton />;

  const notFound = isError && error instanceof ApiError && error.status === 404;
  if (isError || !caseData) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={FileText}
          title={notFound ? 'Case not found' : 'Could not load case'}
          description={
            notFound
              ? 'This case does not exist or you do not have access to it.'
              : 'Something went wrong while loading this case. Please try again.'
          }
          action={
            <Button variant="outline" onClick={() => router.push('/cases')}>
              Back to cases
            </Button>
          }
        />
      </div>
    );
  }

  const c = caseData;

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{c.title}</h1>
            <StatusBadge kind="case" value={c.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {c.caseNumber && <span>{c.caseNumber}</span>}
            {c.court && <span>· {c.court}</span>}
            {c.nextHearingDate && (
              <span className="inline-flex items-center gap-1">
                · <CalendarClock className="h-3.5 w-3.5" /> Next hearing {formatDate(c.nextHearingDate)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Dropdown
            align="right"
            trigger={
              <span className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted">
                Change status
                <ChevronDown className="h-4 w-4" />
              </span>
            }
          >
            {Object.values(CaseStatus).map((s) => (
              <DropdownItem
                key={s}
                disabled={s === c.status || statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
              >
                {Labels.CaseStatus[s]}
                {s === c.status && (
                  <span className="ml-auto text-xs text-muted-foreground">current</span>
                )}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Tabs tabs={TABS} value={tab} onValueChange={(v) => setTab(v as TabKey)} />
      </div>

      {tab === 'overview' && (
        <OverviewTab
          c={c}
          onAddParty={() => setPartyOpen(true)}
          onRemoveParty={(pid) => removePartyMutation.mutate(pid)}
          removingPartyId={removePartyMutation.isPending ? (removePartyMutation.variables as string) : null}
        />
      )}

      {tab === 'timeline' && (
        <TimelineTab
          events={c.timeline}
          onAdd={() => setTimelineOpen(true)}
          onRemove={(eid) => removeTimelineMutation.mutate(eid)}
          removingId={removeTimelineMutation.isPending ? (removeTimelineMutation.variables as string) : null}
        />
      )}

      {tab === 'notes' && (
        <NotesTab
          notes={c.notes}
          value={noteBody}
          onChange={setNoteBody}
          onAdd={() => addNoteMutation.mutate(noteBody.trim())}
          adding={addNoteMutation.isPending}
          onRemove={(nid) => removeNoteMutation.mutate(nid)}
          removingId={removeNoteMutation.isPending ? (removeNoteMutation.variables as string) : null}
        />
      )}

      {tab === 'documents' && <DocumentsTab caseId={id} />}

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit case" className="max-w-2xl">
        <CaseForm
          formId="edit-case-form"
          defaultValues={c}
          submitLabel="Save changes"
          loading={editMutation.isPending}
          onSubmit={(payload) => editMutation.mutate(payload)}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      <PartyModal
        open={partyOpen}
        onClose={() => setPartyOpen(false)}
        loading={addPartyMutation.isPending}
        onSubmit={(payload) => addPartyMutation.mutate(payload)}
      />

      <AddTimelineModal
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        loading={addTimelineMutation.isPending}
        onSubmit={(payload) => addTimelineMutation.mutate(payload)}
      />
    </div>
  );
}

// --- Overview ---------------------------------------------------------------

function OverviewTab({
  c,
  onAddParty,
  onRemoveParty,
  removingPartyId,
}: {
  c: CaseDetailView;
  onAddParty: () => void;
  onRemoveParty: (partyId: string) => void;
  removingPartyId: string | null;
}) {
  const fields = useMemo(
    () => [
      { label: 'Case number', value: c.caseNumber },
      { label: 'CNR', value: c.cnr },
      { label: 'Court', value: c.court },
      { label: 'Court type', value: c.courtType ? Labels.CourtType[c.courtType] : null },
      { label: 'Jurisdiction', value: c.jurisdiction },
      { label: 'Practice area', value: c.practiceArea ? Labels.PracticeArea[c.practiceArea] : null },
      { label: 'Client', value: c.clientName },
      { label: 'Filed on', value: c.filedAt ? formatDate(c.filedAt) : null },
      { label: 'Next hearing', value: c.nextHearingDate ? formatDate(c.nextHearingDate) : null },
    ],
    [c],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Case details</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="mt-0.5 text-sm font-medium">{f.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          {c.description && (
            <div className="mt-6 border-t border-border pt-4">
              <dt className="text-xs text-muted-foreground">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.description}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Parties
              <span className="ml-2 font-normal normal-case text-muted-foreground">{c.parties.length}</span>
            </h2>
            <Button size="sm" variant="outline" onClick={onAddParty}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {c.parties.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No parties added yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {c.parties.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.isClient && <Badge variant="default">Client</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {Labels.CasePartyRole[p.role]}
                      {p.advocateName && ` · ${p.advocateName}`}
                    </div>
                    {(p.contactEmail || p.contactPhone) && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[p.contactEmail, p.contactPhone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    disabled={removingPartyId === p.id}
                    onClick={() => onRemoveParty(p.id)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Timeline ---------------------------------------------------------------

function TimelineTab({
  events,
  onAdd,
  onRemove,
  removingId,
}: {
  events: TimelineEventView[];
  onAdd: () => void;
  onRemove: (eventId: string) => void;
  removingId: string | null;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h2>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add event
          </Button>
        </div>

        {events.length === 0 ? (
          <EmptyState
            className="mt-6 border-none bg-transparent py-10"
            icon={CalendarClock}
            title="No timeline events"
            description="Log hearings, filings and orders to build a chronological history of this case."
            action={
              <Button variant="outline" onClick={onAdd}>
                <Plus className="h-4 w-4" />
                Add event
              </Button>
            }
          />
        ) : (
          <ol className="mt-6 space-y-6">
            {events.map((e, i) => (
              <li key={e.id} className="relative flex gap-4 pl-1">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{Labels.TimelineEventType[e.type]}</Badge>
                      <span className="text-sm font-medium">{e.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(e.eventDate)}</span>
                      <button
                        type="button"
                        aria-label="Remove event"
                        disabled={removingId === e.id}
                        onClick={() => onRemove(e.id)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {e.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{e.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// --- Notes ------------------------------------------------------------------

function NotesTab({
  notes,
  value,
  onChange,
  onAdd,
  adding,
  onRemove,
  removingId,
}: {
  notes: CaseNoteView[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  adding: boolean;
  onRemove: (noteId: string) => void;
  removingId: string | null;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Textarea
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Add a note — a call summary, a strategy point, a reminder to yourself…"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={onAdd} loading={adding} disabled={!value.trim()}>
              Add note
            </Button>
          </div>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No notes yet"
          description="Keep running notes on this matter so nothing slips through the cracks."
        />
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{n.authorName ?? 'You'}</span> · {fromNow(n.createdAt)}
                  </div>
                  <button
                    type="button"
                    aria-label="Remove note"
                    disabled={removingId === n.id}
                    onClick={() => onRemove(n.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Documents --------------------------------------------------------------

function DocumentsTab({ caseId }: { caseId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['documents', { caseId }],
    queryFn: () =>
      api.get<Paginated<DocumentView>>(`/documents${buildQuery({ caseId, pageSize: 100 })}`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <EmptyState icon={FileText} title="Could not load documents" description="Please try again in a moment." />
    );
  }

  const docs = data?.items ?? [];

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents linked"
        description="Upload documents from the Documents section and link them to this case."
        action={
          <Link href="/documents">
            <Button variant="outline">Go to Documents</Button>
          </Link>
        }
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/60">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href="/documents" className="flex min-w-0 items-center gap-3 hover:opacity-80">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{d.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(d.sizeBytes)} · {formatDate(d.createdAt)}
                  </div>
                </div>
              </Link>
              <StatusBadge kind="document" value={d.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const size = bytes / 1024 ** i;
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// --- Shared bits ------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/cases"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to cases
    </Link>
  );
}

function CaseDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-28" />
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
