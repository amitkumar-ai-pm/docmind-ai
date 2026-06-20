'use client';

import { useMemo, useState } from 'react';
import { AppConversation } from '@/types/app';

interface ChatHistorySectionProps {
  conversations: AppConversation[];
  onOpenChat: (conversationId?: string) => void;
  onDelete: (id: string) => void;
}

const DEFAULT_VISIBLE = 5;
const LIST_MAX_HEIGHT = 320;

type DateGroup = 'Today' | 'Yesterday' | 'Earlier';

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

function formatTime(dateStr: string, group: DateGroup) {
  const date = new Date(dateStr);
  if (group === 'Today') {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (group === 'Yesterday') {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'Earlier'];

export default function ChatHistorySection({
  conversations,
  onOpenChat,
  onDelete,
}: ChatHistorySectionProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleConversations = useMemo(
    () =>
      expanded
        ? conversations
        : conversations.slice(0, DEFAULT_VISIBLE),
    [conversations, expanded],
  );

  const grouped = useMemo(() => {
    const groups: Record<DateGroup, AppConversation[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    for (const conv of visibleConversations) {
      groups[getDateGroup(conv.updatedAt)].push(conv);
    }

    return GROUP_ORDER.filter((label) => groups[label].length > 0).map((label) => ({
      label,
      items: groups[label],
    }));
  }, [visibleConversations]);

  const hiddenCount = Math.max(0, conversations.length - DEFAULT_VISIBLE);
  const showToggle = conversations.length > DEFAULT_VISIBLE;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Recent chats</h2>
        <button
          onClick={() => onOpenChat()}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          + New chat
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-slate-500">No conversations yet.</p>
          <button
            onClick={() => onOpenChat()}
            className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Start your first chat
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div
            className="overflow-y-auto"
            style={{ maxHeight: expanded ? LIST_MAX_HEIGHT : undefined }}
          >
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <div className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 px-4 py-2 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {items.map((conv) => {
                    const timeLabel = formatTime(conv.updatedAt, label);
                    return (
                      <li key={conv.id} className="group relative">
                        <button
                          onClick={() => onOpenChat(conv.id)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-brand-50/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate pr-8 text-sm font-medium text-slate-800">
                              {conv.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              {conv.document?.originalName && (
                                <span className="text-slate-500">
                                  {conv.document.originalName}
                                  <span className="mx-1.5 text-slate-300">·</span>
                                </span>
                              )}
                              {conv._count.messages} message
                              {conv._count.messages === 1 ? '' : 's'}
                              <span className="mx-1.5 text-slate-300">·</span>
                              {timeLabel}
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(conv.id);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                          title="Delete chat"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {showToggle && (
            <div className="border-t border-slate-100 px-4 py-2">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {expanded ? 'Show less' : `Show all (${conversations.length})`}
                {!expanded && hiddenCount > 0 && (
                  <span className="ml-1 text-slate-400">· {hiddenCount} more</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
