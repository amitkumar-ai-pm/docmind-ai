'use client';

import { FileIcon } from './FileIcon';
import { formatFileSize, getCategoryMeta, UPLOAD_CATEGORIES } from '@/lib/constants';
import { AppDocument } from '@/types/app';

interface DocumentCardProps {
  document: AppDocument;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onCategoryChange: (id: string, category: string) => void;
  onChat: (documentId: string) => void;
}

export default function DocumentCard({
  document,
  selected,
  onSelect,
  onDelete,
  onCategoryChange,
  onChat,
}: DocumentCardProps) {
  const cat = getCategoryMeta(document.category);

  return (
    <div
      className={`group rounded-2xl border bg-white p-4 shadow-soft transition ${
        selected
          ? 'border-brand-400 ring-2 ring-brand-100'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onSelect(selected ? null : document.id)}
          className="mt-0.5 shrink-0"
          title={selected ? 'Deselect' : 'Select for chat'}
        >
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
              selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 hover:border-brand-400'
            }`}
          >
            {selected && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </button>

        <FileIcon filename={document.originalName} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{document.originalName}</p>
          <p className="mt-0.5 text-xs text-slate-400">{formatFileSize(document.size)}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={document.category}
              onChange={(e) => onCategoryChange(document.id, e.target.value)}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 focus:outline-none ${cat.color}`}
            >
              {UPLOAD_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={() => onChat(document.id)}
            className="rounded-lg p-1.5 text-brand-500 hover:bg-brand-50"
            title="Chat about this document"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(document.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
            title="Remove"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
