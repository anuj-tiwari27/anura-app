'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  RotateCcw,
  ScanText,
  type LucideIcon,
} from 'lucide-react';
import type { DocumentView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Badge, Button, Modal, StatusBadge, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { formatBytes } from './format-bytes';

function fileIconFor(mimeType: string, filename: string): LucideIcon {
  const m = mimeType.toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (m.startsWith('image/')) return FileImage;
  if (m.includes('pdf') || ext === 'pdf') return FileText;
  if (m.includes('sheet') || m.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (m.includes('word') || ['doc', 'docx'].includes(ext)) return FileText;
  if (m.includes('zip') || m.includes('compressed') || ['zip', 'rar', '7z'].includes(ext)) return FileArchive;
  return FileIcon;
}

/** The date an archived document is permanently deleted (30 days after archiving). */
function purgeDate(archivedAt: string | null): string | null {
  if (!archivedAt) return null;
  const d = new Date(archivedAt);
  d.setDate(d.getDate() + 30);
  return formatDate(d.toISOString());
}

interface DocumentsTableProps {
  documents: DocumentView[];
  /** Map of caseId -> case title, for showing the linked case column. */
  caseTitles: Record<string, string>;
}

export function DocumentsTable({ documents, caseTitles }: DocumentsTableProps) {
  const queryClient = useQueryClient();
  const [toArchive, setToArchive] = useState<DocumentView | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents'] });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.post<DocumentView>(`/documents/${id}/archive`),
    onSuccess: () => {
      toast.success('Document archived — recoverable for 30 days');
      setToArchive(null);
      void invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.post<DocumentView>(`/documents/${id}/restore`),
    onSuccess: () => {
      toast.success('Document restored');
      void invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  async function handleDownload(doc: DocumentView) {
    setDownloadingId(doc.id);
    try {
      // Stream the file through the API (works for every storage provider),
      // then save it locally with the original filename.
      const data = await api.blob(`/documents/${doc.id}/file`);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>File</TH>
            <TH className="hidden md:table-cell">Case</TH>
            <TH>Status</TH>
            <TH className="hidden sm:table-cell">Size</TH>
            <TH className="hidden lg:table-cell">Uploaded</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {documents.map((doc) => {
            const Icon = fileIconFor(doc.mimeType, doc.filename);
            const linkedCase = doc.caseId ? caseTitles[doc.caseId] : null;
            const isArchived = doc.status === 'ARCHIVED';
            const deletesOn = purgeDate(doc.archivedAt);
            return (
              <TR key={doc.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground md:hidden">
                        {linkedCase ?? 'No case'}
                      </p>
                    </div>
                  </div>
                </TD>
                <TD className="hidden max-w-[200px] md:table-cell">
                  {linkedCase ? (
                    <span className="block truncate text-sm text-muted-foreground">{linkedCase}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TD>
                <TD>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge kind="document" value={doc.status} />
                    {isArchived && deletesOn ? (
                      <span className="text-xs text-muted-foreground">Deletes {deletesOn}</span>
                    ) : (
                      doc.hasOcr && (
                        <Badge variant="outline" className="gap-1">
                          <ScanText className="h-3 w-3" />
                          OCR
                        </Badge>
                      )
                    )}
                  </div>
                </TD>
                <TD className="hidden whitespace-nowrap text-sm text-muted-foreground sm:table-cell">
                  {formatBytes(doc.sizeBytes)}
                </TD>
                <TD className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                  {formatDate(doc.createdAt)}
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Download ${doc.filename}`}
                      loading={downloadingId === doc.id}
                      onClick={() => handleDownload(doc)}
                    >
                      {downloadingId !== doc.id && <Download className="h-4 w-4" />}
                    </Button>
                    {isArchived ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Restore ${doc.filename}`}
                        title="Restore"
                        className="text-muted-foreground hover:text-success"
                        loading={restoreMutation.isPending && restoreMutation.variables === doc.id}
                        onClick={() => restoreMutation.mutate(doc.id)}
                      >
                        {!(restoreMutation.isPending && restoreMutation.variables === doc.id) && (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Archive ${doc.filename}`}
                        title="Archive"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setToArchive(doc)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Modal
        open={!!toArchive}
        onClose={() => !archiveMutation.isPending && setToArchive(null)}
        title="Archive document"
        description={
          toArchive
            ? `"${toArchive.filename}" will be moved to Archived and permanently deleted after 30 days. You can restore it any time before then.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setToArchive(null)} disabled={archiveMutation.isPending}>
              Cancel
            </Button>
            <Button
              loading={archiveMutation.isPending}
              onClick={() => toArchive && archiveMutation.mutate(toArchive.id)}
            >
              Archive
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Archiving hides the document from your active list. Nothing is deleted immediately.
        </p>
      </Modal>
    </>
  );
}
