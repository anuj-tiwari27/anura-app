'use client';

import { Scale } from 'lucide-react';
import type { CitationView } from '@anura/shared';
import { cn } from '@/lib/utils';

interface CitationChipsProps {
  citations: CitationView[];
  className?: string;
  /** Compact chips (used inside chat bubbles). */
  compact?: boolean;
}

/**
 * Renders judgement citations as small chips. Used under assistant chat
 * replies and beneath generated drafts. Chips link to the research page
 * when a judgementId is present.
 */
export function CitationChips({ citations, className, compact }: CitationChipsProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {citations.map((c, i) => {
        const label = c.citation ?? c.title;
        const chip = (
          <span
            className={cn(
              'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card text-foreground transition-colors',
              compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
              c.judgementId && 'hover:border-primary/40 hover:bg-primary/5',
            )}
          >
            <Scale className={cn('shrink-0 text-primary', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            <span className="truncate font-medium">{label}</span>
            {c.court && !compact && (
              <span className="hidden truncate text-muted-foreground sm:inline">· {c.court}</span>
            )}
          </span>
        );

        return c.judgementId ? (
          <a
            key={`${c.judgementId}-${i}`}
            href={`/research?judgement=${encodeURIComponent(c.judgementId)}`}
            title={c.title}
            className="max-w-full"
          >
            {chip}
          </a>
        ) : (
          <span key={`${label}-${i}`} title={c.title} className="max-w-full">
            {chip}
          </span>
        );
      })}
    </div>
  );
}
