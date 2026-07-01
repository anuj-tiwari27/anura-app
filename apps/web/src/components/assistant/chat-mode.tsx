'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import {
  AIChatRole,
  type AIChatView,
  type AIMessageView,
} from '@anura/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, EmptyState, Spinner } from '@/components/ui';
import { useChat, useChats } from './hooks';
import { ChatList } from './chat-list';
import { ChatMessage, TypingBubble } from './chat-message';
import { ChatComposer } from './chat-composer';

const AI_NOT_CONFIGURED = "AI isn't configured yet — add OPENAI/ANTHROPIC key to .env";

const SUGGESTIONS = [
  'Draft a legal notice for recovery of ₹5,00,000 under a loan agreement.',
  'Summarise the key points to argue in a bail application under Section 439 CrPC.',
  'What are the limitation periods for filing a civil suit for breach of contract?',
];

function isServiceUnavailable(err: unknown): boolean {
  return err instanceof ApiError && err.status === 503;
}

function errMessage(err: unknown): string {
  if (isServiceUnavailable(err)) return AI_NOT_CONFIGURED;
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

export function ChatMode() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  const chatsQuery = useChats();
  const chats = chatsQuery.data ?? [];
  const activeChatQuery = useChat(activeId);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-select the most recent chat once the list loads.
  useEffect(() => {
    if (!activeId && chats.length > 0) setActiveId(chats[0].id);
  }, [activeId, chats]);

  const messages = activeChatQuery.data?.messages ?? [];

  // Keep the transcript pinned to the bottom as it grows / while typing.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pendingContent]);

  const createChat = useMutation({
    mutationFn: () => api.post<AIChatView>('/ai/chats', {}),
    onSuccess: (chat) => {
      qc.setQueryData<AIChatView[]>(['ai', 'chats'], (prev) => [chat, ...(prev ?? [])]);
      qc.setQueryData(['ai', 'chat', chat.id], chat);
      setActiveId(chat.id);
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const deleteChat = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/ai/chats/${id}`),
    onSuccess: (_data, id) => {
      qc.setQueryData<AIChatView[]>(['ai', 'chats'], (prev) =>
        (prev ?? []).filter((c) => c.id !== id),
      );
      qc.removeQueries({ queryKey: ['ai', 'chat', id] });
      if (activeId === id) {
        const remaining = (qc.getQueryData<AIChatView[]>(['ai', 'chats']) ?? []).filter(
          (c) => c.id !== id,
        );
        setActiveId(remaining[0]?.id ?? null);
      }
      toast.success('Chat deleted');
    },
    onError: (err) => toast.error(errMessage(err)),
  });

  const sendMessage = useMutation({
    mutationFn: ({ chatId, content }: { chatId: string; content: string }) =>
      api.post<{ message: AIMessageView; reply: AIMessageView }>(
        `/ai/chats/${chatId}/messages`,
        { content },
      ),
    onMutate: ({ content }) => setPendingContent(content),
    onSuccess: ({ message, reply }, { chatId }) => {
      // Append both the confirmed user message and the assistant reply.
      qc.setQueryData<AIChatView>(['ai', 'chat', chatId], (prev) =>
        prev ? { ...prev, messages: [...(prev.messages ?? []), message, reply] } : prev,
      );
      // Bump the thread to the top of the list and refresh its title/timestamp.
      qc.invalidateQueries({ queryKey: ['ai', 'chats'] });
    },
    onError: (err) => toast.error(errMessage(err)),
    onSettled: () => setPendingContent(null),
  });

  const handleSend = (content: string) => {
    if (!activeId) {
      // No thread yet: create one, then send into it.
      createChat.mutate(undefined, {
        onSuccess: (chat) => sendMessage.mutate({ chatId: chat.id, content }),
      });
      return;
    }
    sendMessage.mutate({ chatId: activeId, content });
  };

  const showThreadLoading = !!activeId && activeChatQuery.isLoading;
  const isEmptyThread = !!activeId && !showThreadLoading && messages.length === 0 && !pendingContent;

  return (
    <Card className="grid h-[calc(100vh-16rem)] min-h-[520px] grid-cols-1 overflow-hidden p-0 md:grid-cols-[17rem_1fr]">
      {/* Left: thread list */}
      <div className="hidden border-r border-border md:block">
        <ChatList
          chats={chats}
          activeId={activeId}
          loading={chatsQuery.isLoading}
          creating={createChat.isPending}
          onSelect={setActiveId}
          onNew={() => createChat.mutate()}
          onDelete={(id) => deleteChat.mutate(id)}
        />
      </div>

      {/* Mobile: horizontal thread strip + new button */}
      <div className="border-b border-border p-2 md:hidden">
        <MobileChatStrip
          chats={chats}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={() => createChat.mutate()}
          creating={createChat.isPending}
        />
      </div>

      {/* Right: transcript + composer */}
      <div className="flex min-h-0 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {showThreadLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          ) : isEmptyThread || !activeId ? (
            <div className="flex h-full flex-col items-center justify-center">
              <EmptyState
                icon={Sparkles}
                title="Your AI legal assistant"
                description="Ask about your cases, draft documents, or research points of law. Replies cite the judgements they rely on."
                className="border-none bg-transparent py-6"
              />
              <div className="mt-2 grid w-full max-w-xl gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    disabled={sendMessage.isPending || createChat.isPending}
                    className="rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {pendingContent && (
                <>
                  <ChatMessage
                    message={{
                      id: 'optimistic-user',
                      role: AIChatRole.USER,
                      content: pendingContent,
                      createdAt: new Date().toISOString(),
                    }}
                  />
                  <TypingBubble />
                </>
              )}
            </>
          )}
        </div>

        <ChatComposer
          onSend={handleSend}
          sending={sendMessage.isPending || createChat.isPending}
          disabled={showThreadLoading}
        />
      </div>
    </Card>
  );
}

/** Compact thread selector shown only on small screens. */
function MobileChatStrip({
  chats,
  activeId,
  onSelect,
  onNew,
  creating,
}: {
  chats: AIChatView[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  creating?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <button
        type="button"
        onClick={onNew}
        disabled={creating}
        className="shrink-0 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-60"
      >
        + New
      </button>
      {chats.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={
            c.id === activeId
              ? 'shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
              : 'shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground'
          }
        >
          <span className="block max-w-[9rem] truncate">{c.title || 'Untitled'}</span>
        </button>
      ))}
    </div>
  );
}
