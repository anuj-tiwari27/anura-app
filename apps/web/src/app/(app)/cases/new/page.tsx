'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { CaseDetailView } from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, PageHeader } from '@/components/ui';
import { CaseForm, type CaseFormPayload } from '@/components/cases/case-form';

export default function NewCasePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: CaseFormPayload) => api.post<CaseDetailView>('/cases', payload),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Case created');
      router.push(`/cases/${created.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/cases"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cases
      </Link>

      <PageHeader title="New case" description="Add a matter to start tracking hearings, parties and documents." />

      <Card>
        <CardContent className="p-6">
          <CaseForm
            submitLabel="Create case"
            loading={mutation.isPending}
            onSubmit={(payload) => mutation.mutate(payload)}
            onCancel={() => router.push('/cases')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
