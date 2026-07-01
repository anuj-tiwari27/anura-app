'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileUp, UploadCloud, X } from 'lucide-react';
import type { DocumentView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button, Field, Select, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatBytes } from './format-bytes';
import { useCaseOptions } from './hooks';

export function UploadDocument() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caseId, setCaseId] = useState<string>('');
  const [dragging, setDragging] = useState(false);

  const { data: cases } = useCaseOptions();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      const form = new FormData();
      form.append('file', file);
      if (caseId) form.append('caseId', caseId);
      return api.upload<DocumentView>('/documents', form);
    },
    onSuccess: (doc) => {
      toast.success(`"${doc.filename}" uploaded`);
      setFile(null);
      setCaseId('');
      if (inputRef.current) inputRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  const pending = uploadMutation.isPending;

  function pickFile(f: File | null | undefined) {
    if (f) setFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (pending) return;
    pickFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a document"
        onClick={() => !pending && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !pending) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!pending) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50',
          pending && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0])}
          disabled={pending}
        />
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">
          <span className="text-primary">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, images and more</p>
      </div>

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <FileUp className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
          </div>
          {!pending && (
            <button
              type="button"
              aria-label="Remove selected file"
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <Field label="Attach to case" hint="Optional — link this document to one of your cases.">
        <Select value={caseId} onChange={(e) => setCaseId(e.target.value)} disabled={pending}>
          <option value="">No case</option>
          {cases?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.caseNumber ? ` · ${c.caseNumber}` : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Button
        type="button"
        className="w-full"
        disabled={!file || pending}
        onClick={() => uploadMutation.mutate()}
      >
        {pending ? (
          <>
            <Spinner className="h-4 w-4 border-primary-foreground/40 border-t-primary-foreground" />
            Uploading…
          </>
        ) : (
          'Upload document'
        )}
      </Button>
    </div>
  );
}
