export interface AppDocument {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  createdAt: string;
}

export interface AppConversation {
  id: string;
  title: string;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
  document?: { originalName: string } | null;
  _count: { messages: number };
}

export interface Citation {
  index: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  sectionTitle: string | null;
  excerpt: string;
  lineStart?: number;
  lineEnd?: number;
  referenceUrl?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export interface CategoryCount {
  category: string;
  _count: { id: number };
}
