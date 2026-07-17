'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileText, Plus, Search } from 'lucide-react';
import type { DocumentView, Paginated } from '@anura/shared';
import { api, ApiError, buildQuery } from '@/lib/api-client';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { DocumentsTable } from '@/components/documents/documents-table';
import { UploadDocument } from '@/components/documents/upload-document';
import { useCaseOptions } from '@/components/documents/hooks';

const PAGE_SIZE = 12;

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [caseId, setCaseId] = useState('');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [view, setView] = useState<'active' | 'archived'>('active');

  const { data: cases } = useCaseOptions();

  const caseTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cases ?? []) map[c.id] = c.title;
    return map;
  }, [cases]);

  const archived = view === 'archived';

  const query = useQuery({
    queryKey: ['documents', { search, caseId, page, archived }],
    queryFn: () =>
      api.get<Paginated<DocumentView>>(
        `/documents${buildQuery({
          page,
          pageSize: PAGE_SIZE,
          search,
          caseId,
          archived: archived ? true : undefined,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const documents = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const total = query.data?.total ?? 0;
  const hasFilters = search.trim() !== '' || caseId !== '';

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload, search, and manage case files. OCR and indexing run automatically."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" />
            Upload
          </Button>
        }
      />

      <Tabs
        tabs={[
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
        ]}
        value={view}
        onValueChange={(v) => {
          setView(v as 'active' | 'archived');
          setPage(1);
        }}
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
              placeholder="Search documents by filename…"
              className="pl-9"
            />
          </div>
          <div className="sm:w-64">
            <Select
              value={caseId}
              onChange={(e) => resetToFirstPage(setCaseId)(e.target.value)}
              aria-label="Filter by case"
            >
              <option value="">All cases</option>
              {cases?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {query.isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={FileText}
          title="Couldn't load documents"
          description={
            query.error instanceof ApiError ? query.error.message : 'Please try again in a moment.'
          }
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            archived
              ? 'No archived documents'
              : hasFilters
                ? 'No matching documents'
                : 'No documents yet'
          }
          description={
            archived
              ? 'Documents you archive appear here and are permanently deleted after 30 days.'
              : hasFilters
                ? 'Try a different search or clear the case filter.'
                : 'Upload your first document to start building your case files.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setCaseId('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4" />
                Upload document
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          <DocumentsTable documents={documents} caseTitles={caseTitles} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} · {total} document{total === 1 ? '' : 's'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || query.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload document"
        description="Drop a file or browse, then optionally attach it to a case."
      >
        <UploadDocument />
      </Modal>
    </div>
  );
}
