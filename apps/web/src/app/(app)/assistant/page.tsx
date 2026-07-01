'use client';

import { useState } from 'react';
import { FileSignature, MessagesSquare } from 'lucide-react';
import { PageHeader, Tabs, type TabItem } from '@/components/ui';
import { ChatMode } from '@/components/assistant/chat-mode';
import { DraftMode } from '@/components/assistant/draft-mode';

const TABS: TabItem[] = [
  {
    value: 'chat',
    label: (
      <span className="flex items-center gap-1.5">
        <MessagesSquare className="h-4 w-4" />
        Chat
      </span>
    ),
  },
  {
    value: 'draft',
    label: (
      <span className="flex items-center gap-1.5">
        <FileSignature className="h-4 w-4" />
        Draft
      </span>
    ),
  },
];

export default function AssistantPage() {
  const [mode, setMode] = useState<'chat' | 'draft'>('chat');

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        description="Chat with your case-aware legal assistant, or generate court-ready drafts in seconds."
        actions={<Tabs tabs={TABS} value={mode} onValueChange={(v) => setMode(v as 'chat' | 'draft')} />}
      />

      {mode === 'chat' ? <ChatMode /> : <DraftMode />}
    </div>
  );
}
