'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import type { TabItem } from '@/components/ui';
import { Button, PageHeader, Tabs } from '@/components/ui';
import { api, ApiError } from '@/lib/api-client';
import { SearchJudgements } from '@/components/research/search-judgements';
import { FindSimilar } from '@/components/research/find-similar';

type TabKey = 'search' | 'similar';

const TABS: TabItem[] = [
  { value: 'search', label: 'Search judgements' },
  { value: 'similar', label: 'Find similar' },
];

export default function ResearchPage() {
  const [tab, setTab] = useState<TabKey>('search');
  const queryClient = useQueryClient();

  const reindex = useMutation({
    mutationFn: () => api.post<{ indexed: number }>('/research/reindex'),
    onSuccess: ({ indexed }) => {
      toast.success(`Reindexed ${indexed} judgement${indexed === 1 ? '' : 's'} into the research corpus.`);
      queryClient.invalidateQueries({ queryKey: ['research'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 503) {
        toast.error('Semantic indexing needs an AI provider key. Add it to enable the research corpus.');
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal Research"
        description="Search reported judgements and surface on-point precedent for the matter at hand."
        actions={
          <Button variant="outline" onClick={() => reindex.mutate()} loading={reindex.isPending}>
            <RefreshCw className="h-4 w-4" />
            Reindex corpus
          </Button>
        }
      />

      <Tabs tabs={TABS} value={tab} onValueChange={(v) => setTab(v as TabKey)} />

      {tab === 'search' ? <SearchJudgements /> : <FindSimilar />}
    </div>
  );
}
