'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  FileText,
  History,
  Receipt,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import type { AuditLogView, Paginated } from '@anura/shared';
import { api, ApiError, buildQuery } from '@/lib/api-client';
import { Button, Card, CardContent, EmptyState, Skeleton } from '@/components/ui';
import { fromNow } from '@/lib/format';

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  'auth.signup': 'Account created',
  'auth.login': 'Signed in',
  'auth.otp_login': 'Signed in with OTP',
  'auth.google_login': 'Signed in with Google',
  'user.onboarding': 'Completed onboarding',
  'user.account_update': 'Account details updated',
  'user.profile_update': 'Profile updated',
  'case.create': 'Case created',
  'case.update': 'Case updated',
  'case.status_change': 'Case status changed',
  'document.upload': 'Document uploaded',
  'document.download': 'Document downloaded',
  'document.archive': 'Document archived',
  'document.restore': 'Document restored',
  'invoice.send': 'Invoice sent',
};

const ENTITY_ICONS: Record<string, LucideIcon> = {
  CASE: Briefcase,
  DOCUMENT: FileText,
  INVOICE: Receipt,
  USER: UserIcon,
};

function labelFor(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const pretty = action.replace(/[._]/g, ' ');
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

/** One-line human summary of the meta payload, when it says something useful. */
function metaSummary(row: AuditLogView): string | null {
  const m = row.meta;
  if (!m) return null;
  if (typeof m.from === 'string' && typeof m.to === 'string') return `${m.from} → ${m.to}`;
  if (typeof m.filename === 'string') return m.filename;
  if (typeof m.title === 'string') return m.title;
  if (typeof m.number === 'string') {
    return typeof m.channel === 'string' ? `${m.number} via ${m.channel}` : m.number;
  }
  if (Array.isArray(m.fields) && m.fields.length > 0) return `Fields: ${m.fields.join(', ')}`;
  return null;
}

export function ActivityTab() {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['audit', { page }],
    queryFn: () =>
      api.get<Paginated<AuditLogView>>(`/audit${buildQuery({ page, pageSize: PAGE_SIZE })}`),
    placeholderData: keepPreviousData,
  });

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={History}
        title="Couldn't load activity"
        description={
          query.error instanceof ApiError ? query.error.message : 'Please try again in a moment.'
        }
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const rows = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Actions you take — creating cases, uploading documents, sending invoices — will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {rows.map((row) => {
              const Icon = (row.entityType && ENTITY_ICONS[row.entityType]) || History;
              const summary = metaSummary(row);
              return (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{labelFor(row.action)}</p>
                    {summary && (
                      <p className="truncate text-xs text-muted-foreground">{summary}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fromNow(row.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
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
  );
}
