'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface ReferenceLine {
  number: number;
  text: string;
  highlighted: boolean;
}

interface ReferenceData {
  document: {
    id: string;
    originalName: string;
    mimeType: string;
  };
  chunk: {
    id: string;
    content: string;
    sectionTitle: string | null;
    lineStart: number;
    lineEnd: number;
  };
  lines: ReferenceLine[];
  fileUrl: string;
  fileUrlWithSearch: string;
  searchSnippet: string;
}

export default function DocumentReferenceView({
  documentId,
  chunkId,
}: {
  documentId: string;
  chunkId: string;
}) {
  const [data, setData] = useState<ReferenceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/documents/${documentId}/reference/${chunkId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load reference');
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reference');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [documentId, chunkId]);

  useEffect(() => {
    if (data && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading reference...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <p className="text-sm text-red-600">{error ?? 'Reference not found'}</p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isPdf = data.document.mimeType === 'application/pdf';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600">DocMind AI</p>
            <h1 className="text-base font-semibold text-slate-900">{data.document.originalName}</h1>
            {data.chunk.sectionTitle && (
              <p className="text-sm text-slate-500">{data.chunk.sectionTitle}</p>
            )}
            <p className="text-xs text-slate-400">
              Lines {data.chunk.lineStart}–{data.chunk.lineEnd}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={data.fileUrlWithSearch}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {isPdf ? 'Open PDF' : 'Open original'}
            </a>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {isPdf && (
        <div className="border-b border-slate-200 bg-white">
          <iframe
            src={data.fileUrlWithSearch}
            title={data.document.originalName}
            className="mx-auto block h-[50vh] w-full max-w-5xl border-0"
          />
          <p className="mx-auto max-w-5xl px-4 py-2 text-center text-xs text-slate-400">
            PDF viewer above · exact referenced lines highlighted below
            {data.searchSnippet ? ` · search: "${data.searchSnippet.slice(0, 50)}..."` : ''}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
            <p className="text-xs font-medium text-slate-500">Referenced excerpt</p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-4 font-mono text-sm leading-relaxed">
            {data.lines.map((line) => (
              <div
                key={line.number}
                ref={line.highlighted ? highlightRef : undefined}
                className={`flex gap-4 rounded px-2 py-0.5 ${
                  line.highlighted ? 'bg-amber-100 text-amber-950' : 'text-slate-700'
                }`}
              >
                <span
                  className={`w-10 shrink-0 select-none text-right text-xs ${
                    line.highlighted ? 'font-semibold text-amber-700' : 'text-slate-400'
                  }`}
                >
                  {line.number}
                </span>
                <span className="whitespace-pre-wrap break-words">{line.text || ' '}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
