'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  MAX_DOCUMENTS,
  MAX_FILE_SIZE_BYTES,
  UPLOAD_CATEGORIES,
  formatFileSize,
} from '@/lib/constants';

interface DocumentUploadProps {
  currentCount: number;
  defaultCategory: string;
  onUploadComplete: () => void;
}

export default function DocumentUpload({
  currentCount,
  defaultCategory,
  onUploadComplete,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(defaultCategory === 'all' ? 'other' : defaultCategory);

  const remaining = MAX_DOCUMENTS - currentCount;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        acceptedFiles.forEach((file) => formData.append('files', file));
        formData.append('category', category);

        const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        onUploadComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [category, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading || remaining <= 0,
    maxSize: MAX_FILE_SIZE_BYTES,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
  });

  if (remaining <= 0) return null;

  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5">
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-slate-600">Document type</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          {UPLOAD_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
          isDragActive
            ? 'border-brand-400 bg-brand-50'
            : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
          <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700">
          {uploading ? 'Processing...' : isDragActive ? 'Drop here' : 'Upload document'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          PDF, Word, Excel, CSV · {formatFileSize(MAX_FILE_SIZE_BYTES)} max · {remaining} slots left
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
