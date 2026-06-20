'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardHeader from '@/components/DashboardHeader';
import ChatHistorySection from '@/components/ChatHistorySection';
import CategoryTabs from '@/components/CategoryTabs';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentCard from '@/components/DocumentCard';
import ChatOverlay from '@/components/ChatOverlay';
import ChatFab from '@/components/ChatFab';
import { MAX_DOCUMENTS, formatFileSize } from '@/lib/constants';
import { AppConversation, AppDocument, CategoryCount, ChatMessage } from '@/types/app';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [allDocuments, setAllDocuments] = useState<AppDocument[]>([]);
  const [counts, setCounts] = useState<CategoryCount[]>([]);
  const [conversations, setConversations] = useState<AppConversation[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const fetchDocuments = useCallback(async (category = activeCategory) => {
    const url = category === 'all' ? '/api/documents' : `/api/documents?category=${category}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents);
      setCounts(data.counts ?? []);
      if (category === 'all') setAllDocuments(data.documents);
    }
  }, [activeCategory]);

  const fetchAllDocs = useCallback(async () => {
    const res = await fetch('/api/documents');
    if (res.ok) {
      const data = await res.json();
      setAllDocuments(data.documents);
      setCounts(data.counts ?? []);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/conversations');
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations);
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    const res = await fetch('/api/suggestions');
    if (res.ok) {
      const data = await res.json();
      setSuggestions(data.suggestions);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDocuments();
      fetchAllDocs();
      fetchConversations();
      fetchSuggestions();
    }
  }, [status, fetchDocuments, fetchAllDocs, fetchConversations, fetchSuggestions]);

  useEffect(() => {
    if (status === 'authenticated') fetchDocuments(activeCategory);
  }, [activeCategory, status, fetchDocuments]);

  async function openChat(conversationId?: string, documentId?: string | null) {
    if (documentId !== undefined) setSelectedDocumentId(documentId);
    setActiveConversationId(conversationId ?? null);
    setMessages([]);

    if (conversationId) {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.conversation.messages);
        if (data.conversation.documentId) {
          setSelectedDocumentId(data.conversation.documentId);
        }
      }
    }

    await fetchSuggestions();
    setChatOpen(true);
  }

  function handleNewChatFromFab() {
    openChat();
  }

  async function handleDeleteConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
      fetchConversations();
    }
  }

  async function handleDeleteDocument(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (selectedDocumentId === id) setSelectedDocumentId(null);
      fetchDocuments();
      fetchAllDocs();
    }
  }

  async function handleCategoryChange(id: string, category: string) {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    if (res.ok) {
      fetchDocuments();
      fetchAllDocs();
    }
  }

  function handleConversationCreated(id: string) {
    setActiveConversationId(id);
    fetchConversations();
  }

  function openChatInNewTab() {
    const params = new URLSearchParams();
    if (activeConversationId) params.set('conversation', activeConversationId);
    if (selectedDocumentId) params.set('document', selectedDocumentId);
    window.open(`/chat?${params.toString()}`, '_blank');
  }

  const totalSize = allDocuments.reduce((sum, d) => sum + d.size, 0);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader
        userName={session?.user?.name}
        userEmail={session?.user?.email}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-8">
        <ChatHistorySection
          conversations={conversations}
          onOpenChat={(id) => openChat(id)}
          onDelete={handleDeleteConversation}
        />

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900">Documents</h2>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>{allDocuments.length}/{MAX_DOCUMENTS} files</span>
              <span>{formatFileSize(totalSize)} total</span>
            </div>
          </div>

          <CategoryTabs
            active={activeCategory}
            counts={counts}
            totalCount={allDocuments.length}
            onChange={setActiveCategory}
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <DocumentUpload
              currentCount={allDocuments.length}
              defaultCategory={activeCategory}
              onUploadComplete={() => { fetchDocuments(); fetchAllDocs(); fetchSuggestions(); }}
            />

            {documents.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8">
                <p className="text-sm text-slate-400">
                  {activeCategory === 'all' ? 'No documents yet' : 'No documents in this category'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    selected={selectedDocumentId === doc.id}
                    onSelect={setSelectedDocumentId}
                    onDelete={handleDeleteDocument}
                    onCategoryChange={handleCategoryChange}
                    onChat={(id) => openChat(undefined, id)}
                  />
                ))}
              </div>
            )}
          </div>

          {selectedDocumentId && (
            <p className="mt-3 text-xs text-brand-600">
              1 document selected — open chat to ask about it specifically
            </p>
          )}
        </section>
      </main>

      {!chatOpen && <ChatFab onClick={handleNewChatFromFab} />}

      <ChatOverlay
        open={chatOpen}
        fullscreen={chatFullscreen}
        conversationId={activeConversationId}
        messages={messages}
        documents={allDocuments}
        selectedDocumentId={selectedDocumentId}
        suggestions={suggestions}
        onClose={() => setChatOpen(false)}
        onToggleFullscreen={() => setChatFullscreen((f) => !f)}
        onOpenNewTab={openChatInNewTab}
        onDocumentChange={setSelectedDocumentId}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
