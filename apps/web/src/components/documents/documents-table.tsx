'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  ScanText,
  Trash2,
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

interface DocumentsTableProps {
  documents: DocumentView[];
  /** Map of caseId -> case title, for showing the linked case column. */
  caseTitles: Record<string, string>;
}

export function DocumentsTable({ documents, caseTitles }: DocumentsTableProps) {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<DocumentView | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/documents/${id}`),
    onSuccess: () => {
      toast.success('Document deleted');
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  async function handleDownload(doc: DocumentView) {
    setDownloadingId(doc.id);
    try {
      const { url } = await api.get<{ url: string }>(`/documents/${doc.id}/download`);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Download link unavailable');
      }
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
                    {doc.hasOcr && (
                      <Badge variant="outline" className="gap-1">
                        <ScanText className="h-3 w-3" />
                        OCR
                      </Badge>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${doc.filename}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setToDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Modal
        open={!!toDelete}
        onClose={() => !deleteMutation.isPending && setToDelete(null)}
        title="Delete document"
        description={
          toDelete
            ? `"${toDelete.filename}" will be permanently removed. This cannot be undone.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Deleting a document also removes it from any linked case and search index.
        </p>
      </Modal>
    </>
  );
}
