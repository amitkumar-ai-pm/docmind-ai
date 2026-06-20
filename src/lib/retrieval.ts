import type { QueryAnalysis } from './query-analysis';

export interface ScoredChunk {
  content: string;
  sectionTitle: string | null;
  documentName: string;
  chunkIndex: number;
  score: number;
}

type DbChunk = {
  content: string;
  chunkIndex: number;
  sectionTitle: string | null;
  document: { originalName: string };
};

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z0-9][a-z0-9-]{1,}\b/g) ?? [];
}

function termFrequency(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (term.length < 3) continue;
    if (term.includes(' ')) {
      if (lower.includes(term)) score += 4;
      continue;
    }
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) score += 1 + Math.log1p(matches.length);
  }

  return score;
}

function phraseScore(text: string, phrases: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const phrase of phrases) {
    if (phrase.length < 3) continue;
    if (lower.includes(phrase)) score += 6;
  }

  return score;
}

function isTocLike(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('table of contents') ||
    /\bchapter\s+\d/i.test(content) ||
    (content.match(/\.{3,}/g)?.length ?? 0) >= 3 ||
    (content.match(/^\s*\d+[\.\)]\s+\S/gm)?.length ?? 0) >= 4
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  return intersection / (setA.size + setB.size - intersection);
}

function scoreChunk(chunk: DbChunk, analysis: QueryAnalysis, avgDocLength: number): number {
  const sectionLabel = chunk.sectionTitle ?? '';
  const searchable = `${sectionLabel} ${chunk.content}`;
  const lower = searchable.toLowerCase();

  let score = 0;

  score += termFrequency(searchable, analysis.expandedTerms) * 2;
  score += phraseScore(searchable, analysis.phrases) * 1.5;
  score += termFrequency(searchable, analysis.topicTerms) * 3;

  if (chunk.sectionTitle) {
    score += termFrequency(chunk.sectionTitle, analysis.expandedTerms) * 4;
    score += phraseScore(chunk.sectionTitle, analysis.phrases) * 5;
  }

  if (analysis.type === 'structure' && isTocLike(chunk.content)) score += 8;
  if (analysis.type === 'structure' && chunk.chunkIndex <= 8) score += 3;
  if (analysis.type === 'coverage' && isTocLike(chunk.content)) score += 5;
  if (analysis.type === 'summary' && chunk.chunkIndex <= 5) score += 2;

  const lengthNorm = Math.min(chunk.content.length / avgDocLength, 2);
  score *= 0.8 + lengthNorm * 0.2;

  if (analysis.type === 'coverage') {
    for (const topic of analysis.topicTerms) {
      if (topic.length > 3 && lower.includes(topic)) score += 3;
    }
  }

  return score;
}

function maximalMarginalRelevance(
  candidates: ScoredChunk[],
  topK: number,
  lambda = 0.7
): ScoredChunk[] {
  if (candidates.length <= topK) return candidates;

  const selected: ScoredChunk[] = [];
  const remaining = [...candidates].sort((a, b) => b.score - a.score);

  selected.push(remaining.shift()!);

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const maxSim = Math.max(
        ...selected.map((s) => jaccardSimilarity(s.content, candidate.content))
      );
      const mmr = lambda * candidate.score - (1 - lambda) * maxSim * 10;
      if (mmr > bestMMR) {
        bestMMR = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected;
}

function selectStructureChunks(chunks: DbChunk[], topK: number): ScoredChunk[] {
  const byDoc = groupByDocument(chunks);
  const selected: ScoredChunk[] = [];

  for (const [, docChunks] of byDoc) {
    docChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    const tocChunks = docChunks.filter((c) => isTocLike(c.content));
    const early = docChunks.slice(0, 8);
    const pool = dedupeChunks([...tocChunks, ...early]);

    for (const chunk of pool) {
      selected.push({
        content: chunk.content,
        sectionTitle: chunk.sectionTitle,
        documentName: chunk.document.originalName,
        chunkIndex: chunk.chunkIndex,
        score: isTocLike(chunk.content) ? 10 : 5,
      });
    }
  }

  return selected
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, topK);
}

function selectSummaryChunks(chunks: DbChunk[], topK: number): ScoredChunk[] {
  const byDoc = groupByDocument(chunks);
  const selected: ScoredChunk[] = [];

  for (const [, docChunks] of byDoc) {
    docChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    const picks = [
      docChunks[0],
      docChunks.find((c) => isTocLike(c.content)),
      docChunks[Math.floor(docChunks.length * 0.25)],
      docChunks[Math.floor(docChunks.length * 0.5)],
    ].filter(Boolean) as DbChunk[];

    for (const chunk of dedupeChunks(picks)) {
      selected.push({
        content: chunk.content,
        sectionTitle: chunk.sectionTitle,
        documentName: chunk.document.originalName,
        chunkIndex: chunk.chunkIndex,
        score: 5,
      });
    }
  }

  return selected.slice(0, topK);
}

function groupByDocument(chunks: DbChunk[]): Map<string, DbChunk[]> {
  const byDoc = new Map<string, DbChunk[]>();
  for (const chunk of chunks) {
    const name = chunk.document.originalName;
    if (!byDoc.has(name)) byDoc.set(name, []);
    byDoc.get(name)!.push(chunk);
  }
  return byDoc;
}

function dedupeChunks(chunks: DbChunk[]): DbChunk[] {
  const seen = new Set<string>();
  return chunks.filter((c) => {
    const key = c.content.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function retrieveChunks(
  chunks: DbChunk[],
  analysis: QueryAnalysis,
  topK: number
): ScoredChunk[] {
  if (chunks.length === 0) return [];

  if (analysis.type === 'structure') {
    return selectStructureChunks(chunks, topK);
  }

  if (analysis.type === 'summary') {
    const summary = selectSummaryChunks(chunks, Math.ceil(topK / 2));
    const hybrid = hybridScore(chunks, analysis, topK);
    const merged = dedupeScored([...summary, ...hybrid]);
    return merged.slice(0, topK);
  }

  return hybridScore(chunks, analysis, topK);
}

function hybridScore(chunks: DbChunk[], analysis: QueryAnalysis, topK: number): ScoredChunk[] {
  const avgLength = chunks.reduce((s, c) => s + c.content.length, 0) / chunks.length || 1000;

  const scored: ScoredChunk[] = chunks.map((chunk) => ({
    content: chunk.content,
    sectionTitle: chunk.sectionTitle,
    documentName: chunk.document.originalName,
    chunkIndex: chunk.chunkIndex,
    score: scoreChunk(chunk, analysis, avgLength),
  }));

  scored.sort((a, b) => b.score - a.score);

  const withScore = scored.filter((c) => c.score > 0);
  const pool = withScore.length >= 3 ? withScore : scored;

  return maximalMarginalRelevance(pool.slice(0, topK * 3), topK);
}

function dedupeScored(chunks: ScoredChunk[]): ScoredChunk[] {
  const seen = new Set<string>();
  return chunks.filter((c) => {
    const key = c.content.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatChunkForContext(chunk: ScoredChunk): string {
  const header = chunk.sectionTitle
    ? `[${chunk.sectionTitle}]`
    : `[Part ${chunk.chunkIndex + 1}]`;
  return `${header}\n${chunk.content}`;
}
