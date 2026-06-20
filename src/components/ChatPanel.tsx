'use client';

import { useEffect, useRef, useState } from 'react';
import { AppDocument, ChatMessage, Citation } from '@/types/app';

function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;

  return (
    <div className="mt-2 space-y-1.5 border-t border-slate-200/60 pt-2">
      <p className="text-xs font-medium text-slate-500">Sources</p>
      {citations.map((c) => {
        const href = c.referenceUrl ?? `/documents/${c.documentId}/reference/${c.chunkId}`;
        const lineLabel =
          c.lineStart && c.lineEnd && c.lineStart !== c.lineEnd
            ? `Lines ${c.lineStart}–${c.lineEnd}`
            : c.lineStart
              ? `Line ${c.lineStart}`
              : null;

        return (
          <a
            key={c.chunkId}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg bg-white/60 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"
          >
            <span className="font-semibold text-brand-600">[{c.index}]</span>{' '}
            <span className="font-medium underline decoration-brand-300 underline-offset-2">
              {c.documentName}
            </span>
            {c.sectionTitle && (
              <span className="text-slate-400"> · {c.sectionTitle}</span>
            )}
            {lineLabel && <span className="text-slate-400"> · {lineLabel}</span>}
            <p className="mt-0.5 line-clamp-2 text-slate-400">{c.excerpt}</p>
            <p className="mt-0.5 text-[10px] font-medium text-brand-500">Open reference ↗</p>
          </a>
        );
      })}
    </div>
  );
}

interface ChatPanelProps {
  conversationId: string | null;
  initialMessages?: ChatMessage[];
  documents: AppDocument[];
  selectedDocumentId: string | null;
  onDocumentChange: (id: string | null) => void;
  onConversationCreated: (id: string) => void;
  suggestions?: string[];
}

export default function ChatPanel({
  conversationId,
  initialMessages = [],
  documents,
  selectedDocumentId,
  onDocumentChange,
  onConversationCreated,
  suggestions = [],
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
    setActiveConversationId(conversationId);
    setError(null);
  }, [conversationId, initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;

    setInput('');
    setError(null);
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: question }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversationId: activeConversationId,
          documentId: selectedDocumentId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get answer');

      if (!activeConversationId) {
        setActiveConversationId(data.conversationId);
        onConversationCreated(data.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, citations: data.citations ?? [] },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendQuestion(input.trim());
  }

  const hasDocuments = documents.length > 0;
  const selectedDoc = documents.find((d) => d.id === selectedDocumentId);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Document scope selector */}
      <div className="border-b border-slate-100 px-4 py-3">
        <label className="mb-1.5 block text-xs font-medium text-slate-500">Ask about</label>
        <select
          value={selectedDocumentId ?? ''}
          onChange={(e) => onDocumentChange(e.target.value || null)}
          disabled={!hasDocuments}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
        >
          <option value="">All documents ({documents.length})</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>{doc.originalName}</option>
          ))}
        </select>
        {selectedDoc && (
          <p className="mt-1.5 text-xs text-brand-600">
            Scoped to: {selectedDoc.originalName}
          </p>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendQuestion(s)}
                disabled={loading || !hasDocuments}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-left text-xs text-slate-600 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
                <svg className="h-7 w-7 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">Ask anything about your documents</p>
              <p className="mt-1 text-xs text-slate-400">
                {hasDocuments ? 'Pick a suggestion or type your question' : 'Upload a document first'}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id ?? i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && msg.citations && (
                <CitationList citations={msg.citations} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-slate-100 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasDocuments ? 'Ask a question...' : 'Upload documents first'}
            disabled={!hasDocuments || loading}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!hasDocuments || loading || !input.trim()}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
