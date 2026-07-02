'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { FileSearch, PencilLine, Sparkles } from 'lucide-react';
import type { CnrLookupView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button, Field, Input, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';

/** sessionStorage key the /cases/new page reads to prefill the form. */
export const CNR_PREFILL_KEY = 'anura_cnr_prefill';

interface NewCaseModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewCaseModal({ open, onClose }: NewCaseModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'cnr'>('choose');
  const [cnr, setCnr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // The Modal can be dismissed (Escape/backdrop/X) while a lookup is in
  // flight; the response must not hijack navigation after that.
  const cancelledRef = useRef(false);

  const lookup = useMutation({
    mutationFn: (value: string) =>
      api.get<CnrLookupView>(`/cases/cnr/${encodeURIComponent(value)}`),
    onSuccess: (result) => {
      if (cancelledRef.current) return;
      try {
        sessionStorage.setItem(CNR_PREFILL_KEY, JSON.stringify(result));
      } catch {
        // Storage full/blocked — the form just opens empty.
      }
      close();
      router.push('/cases/new');
    },
    onError: (err) => {
      if (cancelledRef.current) return;
      if (err instanceof ApiError && err.status === 503) {
        setUnavailable(true);
        setError(null);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong, try again.');
      }
    },
  });

  const close = () => {
    cancelledRef.current = true;
    setMode('choose');
    setCnr('');
    setError(null);
    setUnavailable(false);
    lookup.reset();
    onClose();
  };

  const goManual = () => {
    close();
    router.push('/cases/new');
  };

  const submitCnr = () => {
    if (lookup.isPending || unavailable) return;
    // CNRs are often printed with hyphens/spaces (MHAU01-003198-2016).
    const value = cnr.trim().toUpperCase().replace(/[\s-]/g, '');
    if (value.length < 10) {
      setError('CNR numbers are 16 characters, e.g. DLND020047882015');
      return;
    }
    setError(null);
    cancelledRef.current = false;
    lookup.mutate(value);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New case"
      description={
        mode === 'choose'
          ? 'How do you want to add this matter?'
          : 'Enter the CNR printed on the case status page or court filing.'
      }
    >
      {mode === 'choose' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard
            icon={<FileSearch className="h-5 w-5" />}
            title="Fetch from CNR"
            description="Pull title, court, parties and hearing dates from the eCourts registry."
            badge="Fastest"
            onClick={() => setMode('cnr')}
          />
          <OptionCard
            icon={<PencilLine className="h-5 w-5" />}
            title="Enter manually"
            description="Type the case details yourself, field by field."
            onClick={goManual}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="CNR number" htmlFor="cnr-input" error={error ?? undefined} hint="16-character Case Number Record, e.g. DLND020047882015">
            <Input
              id="cnr-input"
              value={cnr}
              onChange={(e) => setCnr(e.target.value.toUpperCase())}
              placeholder="DLND020047882015"
              autoFocus
              maxLength={30}
              className="font-mono tracking-wide"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitCnr();
                }
              }}
            />
          </Field>

          {unavailable && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              eCourts lookup is not configured on this workspace yet. You can still add the
              case manually and fill in the CNR for later syncing.
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setMode('choose')} disabled={lookup.isPending}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={goManual} disabled={lookup.isPending}>
                Enter manually
              </Button>
              <Button type="button" onClick={submitCnr} loading={lookup.isPending} disabled={unavailable}>
                <Sparkles className="h-4 w-4" />
                Fetch details
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function OptionCard({
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left',
        'transition-colors hover:border-primary/50 hover:bg-primary/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {badge}
        </span>
      )}
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}
