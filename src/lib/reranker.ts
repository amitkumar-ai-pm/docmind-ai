import { QueryAnalysis } from './query-analysis';
import { RankedItem } from './hybrid-search';

export interface ChunkCandidate {
  id: string;
  content: string;
  sectionTitle: string | null;
  chunkType: string;
  chunkIndex: number;
  documentName: string;
  documentId: string;
  embedding: number[] | null;
  hybrid: RankedItem;
}

function isTocLike(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('table of contents') ||
    /\bchapter\s+\d/i.test(content) ||
    (content.match(/\.{3,}/g)?.length ?? 0) >= 3
  );
}

function termOverlap(query: string, content: string): number {
  const qTerms = new Set(
    query.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) ?? []
  );
  const cTerms = content.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) ?? [];
  let hits = 0;
  for (const t of cTerms) {
    if (qTerms.has(t)) hits++;
  }
  return qTerms.size > 0 ? hits / qTerms.size : 0;
}

export function rerankChunks(
  candidates: ChunkCandidate[],
  query: string,
  queryEmbedding: number[] | null,
  analysis: QueryAnalysis,
  topK: number
): ChunkCandidate[] {
  const scored = candidates.map((c) => {
    let score = c.hybrid.rrfScore * 10;

    if (queryEmbedding && c.embedding?.length) {
      const sim = cosineSimilarity(queryEmbedding, c.embedding);
      score += sim * 5;
    }

    score += c.hybrid.bm25Score * 0.5;
    score += termOverlap(query, c.content ?? '') * 3;

    if (c.sectionTitle) {
      score += termOverlap(query, c.sectionTitle) * 4;
    }

    if (analysis.type === 'structure' && (c.chunkType === 'toc' || isTocLike(c.content ?? ''))) {
      score += 6;
    }
    if (analysis.type === 'coverage' && isTocLike(c.content ?? '')) score += 4;
    if (analysis.type === 'summary' && c.chunkIndex <= 5) score += 2;

    for (const phrase of analysis.phrases ?? []) {
      if ((c.content ?? '').toLowerCase().includes(phrase)) score += 3;
    }

    return { candidate: c, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: ChunkCandidate[] = [];
  const seen = new Set<string>();

  for (const { candidate } of scored) {
    const content = candidate.content ?? '';
    const key = content.slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(candidate);
    if (selected.length >= topK) break;
  }

  return selected;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
