'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { SendHorizonal } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ChatComposerProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  sending?: boolean;
}

/** Bottom-of-chat input: auto-growing textarea, Enter to send, Shift+Enter for newline. */
export function ChatComposer({ onSend, disabled, sending }: ChatComposerProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || sending) return;
    onSend(trimmed);
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="border-t border-border bg-card/60 p-3">
      <div
        className={cn(
          'flex items-end gap-2 rounded-xl border border-input bg-card p-2 shadow-sm transition-colors',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background',
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask about a case, draft a notice, or research a point of law…"
          className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
        />
        <Button
          size="icon"
          onClick={submit}
          disabled={disabled || sending || value.trim() === ''}
          loading={sending}
          aria-label="Send message"
          className="h-9 w-9 shrink-0"
        >
          {!sending && <SendHorizonal className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
        Enter to send · Shift + Enter for a new line. Anura can make mistakes — verify important
        details.
      </p>
    </div>
  );
}
