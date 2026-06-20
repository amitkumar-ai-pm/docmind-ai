'use client';

import { AppConversation } from '@/types/app';

interface ChatHistorySectionProps {
  conversations: AppConversation[];
  onOpenChat: (conversationId?: string) => void;
  onDelete: (id: string) => void;
}

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function ChatHistorySection({
  conversations,
  onOpenChat,
  onDelete,
}: ChatHistorySectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Recent chats</h2>
        <button
          onClick={() => onOpenChat()}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          + New chat
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">No conversations yet.</p>
          <button
            onClick={() => onOpenChat()}
            className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Start your first chat
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:border-brand-200 hover:shadow-md"
            >
              <button
                onClick={() => onOpenChat(conv.id)}
                className="w-full text-left"
              >
                <p className="line-clamp-2 pr-6 text-sm font-medium text-slate-800">
                  {conv.title}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{formatRelative(conv.updatedAt)}</span>
                  <span>·</span>
                  <span>{conv._count.messages} messages</span>
                  {conv.document && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[120px]">{conv.document.originalName}</span>
                    </>
                  )}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="absolute right-3 top-3 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                title="Delete chat"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
