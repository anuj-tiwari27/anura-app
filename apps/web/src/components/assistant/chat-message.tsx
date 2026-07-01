'use client';

import { Sparkles } from 'lucide-react';
import { AIChatRole, type AIMessageView } from '@anura/shared';
import { useAuth } from '@/lib/auth-store';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CitationChips } from './citation-chips';

/** A single chat bubble: user aligned right, assistant left. */
export function ChatMessage({ message }: { message: AIMessageView }) {
  const user = useAuth((s) => s.user);
  const isUser = message.role === AIChatRole.USER;

  return (
    <div className={cn('flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          isUser ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary',
        )}
        aria-hidden
      >
        {isUser ? initials(user?.fullName ?? user?.email) : <Sparkles className="h-4 w-4" />}
      </div>

      <div className={cn('flex max-w-[80%] flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
            isUser
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md border border-border bg-card text-foreground',
          )}
        >
          {message.content}
        </div>
        {message.citations && message.citations.length > 0 && (
          <CitationChips citations={message.citations} compact />
        )}
      </div>
    </div>
  );
}

/** Animated "assistant is typing" indicator shown while awaiting a reply. */
export function TypingBubble() {
  return (
    <div className="flex w-full gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3.5 shadow-sm">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
    </div>
  );
}
