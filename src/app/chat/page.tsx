'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatPanel from '@/components/ChatPanel';
import DashboardHeader from '@/components/DashboardHeader';
import { AppDocument, ChatMessage } from '@/types/app';

function ChatPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    searchParams.get('conversation')
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    searchParams.get('document')
  );

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const loadData = useCallback(async () => {
    const [docsRes, sugRes] = await Promise.all([
      fetch('/api/documents'),
      fetch('/api/suggestions'),
    ]);

    if (docsRes.ok) {
      const data = await docsRes.json();
      setDocuments(data.documents);
    }
    if (sugRes.ok) {
      const data = await sugRes.json();
      setSuggestions(data.suggestions);
    }

    const convId = searchParams.get('conversation');
    if (convId) {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.conversation.messages);
        setConversationId(convId);
        if (data.conversation.documentId) {
          setSelectedDocumentId(data.conversation.documentId);
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'authenticated') loadData();
  }, [status, loadData]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <DashboardHeader userName={session?.user?.name} userEmail={session?.user?.email} />
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          conversationId={conversationId}
          initialMessages={messages}
          documents={documents}
          selectedDocumentId={selectedDocumentId}
          onDocumentChange={setSelectedDocumentId}
          onConversationCreated={(id) => {
            setConversationId(id);
            window.history.replaceState(null, '', `/chat?conversation=${id}`);
          }}
          suggestions={suggestions}
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
