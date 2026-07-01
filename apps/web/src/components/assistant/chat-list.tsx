'use client';

import { MessageSquarePlus, MoreVertical, Trash2 } from 'lucide-react';
import type { AIChatView } from '@anura/shared';
import { fromNow } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button, Dropdown, DropdownItem, Skeleton } from '@/components/ui';

interface ChatListProps {
  chats: AIChatView[];
  activeId: string | null;
  loading?: boolean;
  creating?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

/** Left pane: a scrollable list of chat threads plus a "New chat" action. */
export function ChatList({
  chats,
  activeId,
  loading,
  creating,
  onSelect,
  onNew,
  onDelete,
}: ChatListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <Button className="w-full" onClick={onNew} loading={creating}>
          {!creating && <MessageSquarePlus className="h-4 w-4" />}
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No conversations yet. Start a new chat to ask Anura anything.
          </p>
        ) : (
          <ul className="space-y-1">
            {chats.map((chat) => {
              const active = chat.id === activeId;
              return (
                <li key={chat.id}>
                  <div
                    className={cn(
                      'group flex items-center gap-1 rounded-lg border border-transparent transition-colors',
                      active ? 'border-border bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(chat.id)}
                      className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {chat.title || 'Untitled chat'}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {fromNow(chat.updatedAt)}
                      </span>
                    </button>
                    <div className="pr-1.5 opacity-0 transition-opacity group-hover:opacity-100 aria-expanded:opacity-100">
                      <Dropdown
                        align="right"
                        trigger={
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </span>
                        }
                      >
                        <DropdownItem
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => onDelete(chat.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete chat
                        </DropdownItem>
                      </Dropdown>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
