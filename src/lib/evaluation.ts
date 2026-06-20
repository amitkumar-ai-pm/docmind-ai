import { Citation, RetrievedChunk } from './rag';

export interface RetrievalMetrics {
  hitRate: boolean;
  mrr: number;
  precisionAt5: number;
  faithfulness: number;
  citationCoverage: number;
  answerRelevance: number;
  citedChunkIds: string[];
  groundingPassed: boolean;
}

export interface EvaluationResult {
  metrics: RetrievalMetrics;
  warnings: string[];
}

/** Check that inline citations [n] map to retrieved chunks only. */
export function evaluateResponse(
  answer: string,
  citations: Citation[],
  chunks: RetrievedChunk[],
  question: string
): EvaluationResult {
  const warnings: string[] = [];
  const citedIndices = extractCitationIndices(answer);
  const validIndices = new Set(citations.map((c) => c.index));
  const citedChunkIds = citations
    .filter((c) => citedIndices.includes(c.index))
    .map((c) => c.chunkId);

  const invalidCitations = citedIndices.filter((i) => !validIndices.has(i));
  if (invalidCitations.length > 0) {
    warnings.push(`Answer cites unknown indices: ${invalidCitations.join(', ')}`);
  }

  const groundingPassed = invalidCitations.length === 0;
  const hitRate = chunks.length > 0;
  const mrr = hitRate ? 1 / (chunks[0]?.citationIndex ?? 1) : 0;

  const relevantTerms = question
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  const top5 = chunks.slice(0, 5);
  const precisionAt5 =
    top5.length === 0
      ? 0
      : top5.filter((c) => chunkMatchesTerms(c.content, relevantTerms)).length / top5.length;

  const citationCoverage =
    citations.length === 0 ? 0 : citedIndices.length / citations.length;

  const faithfulness = computeFaithfulness(answer, citedIndices, citations, chunks);
  const answerRelevance = computeAnswerRelevance(answer, question, chunks);

  const metrics: RetrievalMetrics = {
    hitRate,
    mrr,
    precisionAt5,
    faithfulness,
    citationCoverage,
    answerRelevance,
    citedChunkIds,
    groundingPassed,
  };

  return { metrics, warnings };
}

function extractCitationIndices(answer: string): number[] {
  const matches = answer.match(/\[(\d+)\]/g) ?? [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/\D/g, ''), 10)))].filter(
    (n) => !Number.isNaN(n)
  );
}

function chunkMatchesTerms(content: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const lower = content.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

function computeFaithfulness(
  answer: string,
  citedIndices: number[],
  citations: Citation[],
  chunks: RetrievedChunk[]
): number {
  if (citedIndices.length === 0) return chunks.length > 0 ? 0.3 : 0;
  const citedContent = citations
    .filter((c) => citedIndices.includes(c.index))
    .map((c) => c.excerpt.toLowerCase());

  const answerWords = answer
    .toLowerCase()
    .replace(/\[\d+\]/g, '')
    .split(/\W+/)
    .filter((w) => w.length > 4);

  if (answerWords.length === 0) return 0.5;

  const supported = answerWords.filter((w) =>
    citedContent.some((excerpt) => excerpt.includes(w))
  );

  return Math.min(1, supported.length / Math.max(answerWords.length * 0.15, 1));
}

function computeAnswerRelevance(
  answer: string,
  question: string,
  chunks: RetrievedChunk[]
): number {
  const qTerms = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const aLower = answer.toLowerCase();
  const qOverlap = qTerms.filter((t) => aLower.includes(t)).length;
  const chunkOverlap = chunks.some((c) => qTerms.some((t) => c.content.toLowerCase().includes(t)));

  let score = 0.4;
  if (qOverlap > 0) score += 0.3;
  if (chunkOverlap) score += 0.2;
  if (answer.length > 40) score += 0.1;
  return Math.min(1, score);
}

export function logEvaluation(
  event: string,
  result: EvaluationResult,
  extra?: Record<string, unknown>
): void {
  console.info(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      metrics: result.metrics,
      warnings: result.warnings,
      ...extra,
    })
  );
}
