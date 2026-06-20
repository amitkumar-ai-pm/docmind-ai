'use client';

import { formatFileSize } from '@/lib/constants';
import { FileIcon } from './FileIcon';

interface Document {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
}

export default function DocumentList({ documents, onDelete }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-gray-500">No documents uploaded yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <FileIcon filename={doc.originalName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{doc.originalName}</p>
              <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
            </div>
          </div>
          <button
            onClick={() => onDelete(doc.id)}
            className="ml-2 shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Remove document"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
