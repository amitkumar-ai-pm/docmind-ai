'use client';

import ChatPanel from './ChatPanel';
import { AppDocument, ChatMessage } from '@/types/app';

interface ChatOverlayProps {
  open: boolean;
  fullscreen: boolean;
  conversationId: string | null;
  messages: ChatMessage[];
  documents: AppDocument[];
  selectedDocumentId: string | null;
  suggestions: string[];
  onClose: () => void;
  onToggleFullscreen: () => void;
  onOpenNewTab: () => void;
  onDocumentChange: (id: string | null) => void;
  onConversationCreated: (id: string) => void;
}

export default function ChatOverlay({
  open,
  fullscreen,
  conversationId,
  messages,
  documents,
  selectedDocumentId,
  suggestions,
  onClose,
  onToggleFullscreen,
  onOpenNewTab,
  onDocumentChange,
  onConversationCreated,
}: ChatOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`relative flex flex-col bg-white shadow-float transition-all ${
          fullscreen
            ? 'h-full w-full'
            : 'h-[90vh] w-full sm:h-[85vh] sm:max-h-[700px] sm:w-[95vw] sm:max-w-2xl sm:rounded-2xl'
        }`}
      >
        {/* Overlay header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
              <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-800">Chat</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenNewTab}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Open in new tab"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
            <button
              onClick={onToggleFullscreen}
              className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 sm:block"
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatPanel
            conversationId={conversationId}
            initialMessages={messages}
            documents={documents}
            selectedDocumentId={selectedDocumentId}
            onDocumentChange={onDocumentChange}
            onConversationCreated={onConversationCreated}
            suggestions={suggestions}
          />
        </div>
      </div>
    </div>
  );
}
