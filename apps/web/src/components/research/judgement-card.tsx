'use client';

import { ExternalLink, Scale } from 'lucide-react';
import { Labels, type JudgementView } from '@anura/shared';
import { formatDate } from '@/lib/format';
import { Badge, Card } from '@/components/ui';

interface JudgementCardProps {
  judgement: JudgementView;
  /** 0..1 cosine similarity. When present, renders a "NN% match" badge and rank. */
  score?: number;
  rank?: number;
}

export function JudgementCard({ judgement, score, rank }: JudgementCardProps) {
  const j = judgement;

  return (
    <Card className="p-5 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {typeof rank === 'number' && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {rank}
              </span>
            )}
            <h3 className="font-display text-base font-semibold leading-snug text-foreground">
              {j.url ? (
                <a
                  href={j.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:underline"
                >
                  {j.title}
                </a>
              ) : (
                j.title
              )}
            </h3>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {j.court && <span className="font-medium text-foreground/80">{j.court}</span>}
            {j.court && (j.citation || j.decidedAt) && <span aria-hidden>·</span>}
            {j.citation && <span className="italic">{j.citation}</span>}
            {j.citation && j.decidedAt && <span aria-hidden>·</span>}
            {j.decidedAt && <span>{formatDate(j.decidedAt)}</span>}
          </div>
        </div>

        {typeof score === 'number' && (
          <Badge variant="success" className="shrink-0">
            {Math.round(score * 100)}% match
          </Badge>
        )}
      </div>

      {j.summary && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-4">{j.summary}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {j.practiceArea && (
          <Badge variant="outline" className="gap-1">
            <Scale className="h-3 w-3" />
            {Labels.PracticeArea[j.practiceArea]}
          </Badge>
        )}
        {j.url && (
          <a
            href={j.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Read full judgement
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </Card>
  );
}
