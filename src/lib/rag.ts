import { prisma } from './prisma';
import {
  chunkText,
  CURRENT_CHUNK_VERSION,
  extractTableOfContents,
  ParsedChunk,
} from './chunking';
import { embedText, embedTexts, serializeEmbedding } from './embeddings';
import { bm25TopK } from './bm25';
import { HYBRID_CANDIDATE_K, reciprocalRankFusion, RERANK_TOP_K } from './hybrid-search';
import { expandQuery, analyzeAndExpandQuery, getRetrievalConfig } from './query-analysis';
import { ChunkCandidate, rerankChunks } from './reranker';
import { truncateText } from './document-parser';
import { metadataSearchText, parseMetadata } from './metadata';
import { createTimer, logMetric } from './observability';
import {
  isPgVectorEnabled,
  vectorSearchLocal,
  vectorSearchPg,
} from './vector-store';

import { attachChunkOffsets } from './text-offsets';

export interface Citation {
  index: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  sectionTitle: string | null;
  excerpt: string;
  lineStart: number;
  lineEnd: number;
  referenceUrl: string;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  documentName: string;
  documentId: string;
  sectionTitle: string | null;
  chunkType: string;
  score: number;
  citationIndex: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  citations: Citation[];
  analysis: Awaited<ReturnType<typeof analyzeAndExpandQuery>>;
}

async function saveChunks(
  documentId: string,
  parsed: ParsedChunk[],
  embeddings?: number[][]
): Promise<void> {
  await prisma.documentChunk.deleteMany({ where: { documentId } });

  for (let i = 0; i < parsed.length; i++) {
    const chunk = parsed[i];
    await prisma.documentChunk.create({
      data: {
        documentId,
        chunkIndex: chunk.chunkIndex,
        sectionTitle: chunk.sectionTitle,
        chapterTitle: chunk.chapterTitle,
        chunkType: chunk.chunkType,
        content: chunk.content,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        pageNumber: chunk.pageNumber,
        embedding: embeddings?.[i] ? serializeEmbedding(embeddings[i]) : '[]',
      },
    });
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { chunkVersion: CURRENT_CHUNK_VERSION },
  });
}

function buildChunksWithToc(text: string): ParsedChunk[] {
  const parsed = chunkText(text);
  const toc = extractTableOfContents(text);

  if (toc && !parsed.some((c) => c.chunkType === 'toc')) {
    parsed.unshift({
      content: `[Table of Contents]\n${toc}`,
      chapterTitle: null,
      sectionTitle: 'Table of Contents',
      chunkType: 'toc',
      chunkIndex: 0,
      startOffset: 0,
      endOffset: 0,
      lineStart: 1,
      lineEnd: 1,
      pageNumber: 1,
    });
    parsed.forEach((c, i) => {
      c.chunkIndex = i;
    });
    return attachChunkOffsets(text.replace(/\r\n/g, '\n').replace(/\f/g, '\n\n').trim(), parsed);
  }

  return parsed;
}

export async function indexDocument(documentId: string, text: string): Promise<void> {
  const parsed = buildChunksWithToc(text);
  if (parsed.length === 0) return;

  const embedTimer = createTimer('embedding', { documentId, chunkCount: parsed.length });

  try {
    const embeddings = await embedTexts(parsed.map((c) => c.content));
    embedTimer.end({ embedded: embeddings.length });
    await saveChunks(documentId, parsed, embeddings);
  } catch (error) {
    embedTimer.end({ embedded: 0, fallback: true });
    console.warn('Embedding failed, saving chunks without vectors:', error);
    await saveChunks(documentId, parsed);
  }
}

export async function ensureDocumentsIndexed(
  userId: string,
  documentId?: string | null
): Promise<void> {
  const where = documentId ? { userId, id: documentId } : { userId };

  const documents = await prisma.document.findMany({
    where,
    select: {
      id: true,
      extractedText: true,
      chunkVersion: true,
      _count: { select: { chunks: true } },
    },
  });

  const toIndex = documents.filter(
    (d) =>
      d.extractedText.trim() &&
      (d._count.chunks === 0 || d.chunkVersion < CURRENT_CHUNK_VERSION)
  );

  await Promise.all(toIndex.map((d) => indexDocument(d.id, d.extractedText)));
  await ensureEmbeddings(userId, documentId);
}

/** Backfill embeddings for chunks that were indexed without vectors. */
async function ensureEmbeddings(
  userId: string,
  documentId?: string | null
): Promise<void> {
  const where = documentId
    ? { document: { userId, id: documentId }, embedding: '[]' }
    : { document: { userId }, embedding: '[]' };

  const missing = await prisma.documentChunk.findMany({
    where,
    select: { id: true, content: true },
    take: 100,
  });

  if (missing.length === 0) return;

  try {
    const BATCH = 16;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const embeddings = await embedTexts(batch.map((c) => c.content));
      await Promise.all(
        batch.map((chunk, idx) =>
          prisma.documentChunk.update({
            where: { id: chunk.id },
            data: { embedding: serializeEmbedding(embeddings[idx]) },
          })
        )
      );
    }
  } catch (error) {
    console.warn('Embedding backfill skipped:', error);
  }
}

async function loadChunks(
  userId: string,
  documentId: string | null,
  category?: string | null
) {
  const where = documentId
    ? { document: { userId, id: documentId } }
    : category
      ? { document: { userId, category } }
      : { document: { userId } };

  return prisma.documentChunk.findMany({
    where,
    select: {
      id: true,
      content: true,
      chunkIndex: true,
      sectionTitle: true,
      chapterTitle: true,
      chunkType: true,
      lineStart: true,
      lineEnd: true,
      pageNumber: true,
      embedding: true,
      documentId: true,
      document: {
        select: {
          originalName: true,
          category: true,
          metadata: true,
        },
      },
    },
    orderBy: { chunkIndex: 'asc' },
  });
}

export async function retrieveRelevantChunks(
  userId: string,
  question: string,
  options?: {
    topK?: number;
    documentId?: string | null;
    category?: string | null;
    analysis?: Awaited<ReturnType<typeof analyzeAndExpandQuery>>;
  }
): Promise<RetrievalResult> {
  const timer = createTimer('retrieval');
  const documentId = options?.documentId ?? null;
  const analysis = options?.analysis ?? (await analyzeAndExpandQuery(question));
  const config = getRetrievalConfig(analysis);
  const finalK = options?.topK ?? RERANK_TOP_K;

  await ensureDocumentsIndexed(userId, documentId);

  const dbChunks = await loadChunks(userId, documentId, options?.category);

  if (dbChunks.length === 0) {
    return { chunks: [], citations: [], analysis };
  }

  const expandedQuery = expandQuery(question, analysis);

  const metadataCache = new Map<string, string>();
  for (const c of dbChunks) {
    if (!metadataCache.has(c.documentId)) {
      const meta = parseMetadata(c.document.metadata);
      metadataCache.set(c.documentId, metadataSearchText(meta));
    }
  }

  // --- BM25 leg (metadata + structure boost) ---
  const texts = dbChunks.map((c) => {
    const meta = metadataCache.get(c.documentId) ?? '';
    const structure = [c.chapterTitle, c.sectionTitle, c.document.category]
      .filter(Boolean)
      .join(' ');
    return `${meta} ${structure} ${c.content ?? ''}`.trim();
  });
  const bm25Results = bm25TopK(texts, expandedQuery, HYBRID_CANDIDATE_K).map(
    (r) => ({ id: dbChunks[r.index].id, score: r.score })
  );

  // --- Vector leg ---
  let vectorResults: { id: string; score: number }[] = [];
  let queryEmbedding: number[] | null = null;

  try {
    queryEmbedding = await embedText(expandedQuery);

    if (isPgVectorEnabled()) {
      vectorResults = await vectorSearchPg(
        queryEmbedding,
        userId,
        documentId,
        HYBRID_CANDIDATE_K
      );
    }

    if (vectorResults.length === 0) {
      vectorResults = vectorSearchLocal(
        dbChunks.map((c) => ({ id: c.id, embedding: c.embedding })),
        queryEmbedding,
        HYBRID_CANDIDATE_K
      );
    }
  } catch (error) {
    console.warn('Vector search unavailable, using BM25 only:', error);
  }

  // --- Hybrid fusion: top 20 ---
  const fused = reciprocalRankFusion(vectorResults, bm25Results).slice(
    0,
    HYBRID_CANDIDATE_K
  );

  const chunkMap = new Map(dbChunks.map((c) => [c.id, c]));

  const candidates: ChunkCandidate[] = fused
    .map((f) => {
      const c = chunkMap.get(f.id);
      if (!c) return null;
      let embedding: number[] | null = null;
      try {
        if (c.embedding && c.embedding !== '[]') {
          embedding = JSON.parse(c.embedding) as number[];
        }
      } catch {
        embedding = null;
      }
      return {
        id: c.id,
        content: c.content,
        sectionTitle: c.sectionTitle,
        chunkType: c.chunkType,
        chunkIndex: c.chunkIndex,
        documentName: c.document.originalName,
        documentId: c.documentId,
        embedding,
        hybrid: f,
      };
    })
    .filter(Boolean) as ChunkCandidate[];

  // --- Reranker: top 20 → top 5 ---
  const reranked = rerankChunks(
    candidates,
    expandedQuery,
    queryEmbedding,
    analysis,
    finalK
  );

  const chunks: RetrievedChunk[] = reranked.map((c, i) => ({
    id: c.id,
    content: c.content,
    documentName: c.documentName,
    documentId: c.documentId,
    sectionTitle: c.sectionTitle,
    chunkType: c.chunkType,
    score: c.hybrid.rrfScore,
    citationIndex: i + 1,
  }));

  const citations: Citation[] = chunks.map((c) => {
    const dbChunk = chunkMap.get(c.id);
    const content = c.content ?? '';
    return {
      index: c.citationIndex,
      chunkId: c.id,
      documentId: c.documentId,
      documentName: c.documentName,
      sectionTitle: c.sectionTitle,
      excerpt: content.slice(0, 200).trim() + (content.length > 200 ? '...' : ''),
      lineStart: dbChunk?.lineStart ?? 1,
      lineEnd: dbChunk?.lineEnd ?? 1,
      referenceUrl: `/documents/${c.documentId}/reference/${c.id}`,
    };
  });

  timer.end({
    chunkCount: dbChunks.length,
    resultCount: chunks.length,
    queryType: analysis.type,
    documentScoped: Boolean(documentId),
  });

  return { chunks, citations, analysis };
}

export function buildRagContext(
  chunks: RetrievedChunk[],
  maxChars?: number
): string {
  const limit = maxChars ?? 14_000;
  const meaningful = chunks.filter((c) => c.content.trim().length > 20);

  if (meaningful.length === 0) {
    return 'No document text could be extracted.';
  }

  let context = '';
  for (const chunk of meaningful) {
    const header = chunk.sectionTitle
      ? `[${chunk.citationIndex}] ${chunk.documentName} — ${chunk.sectionTitle}`
      : `[${chunk.citationIndex}] ${chunk.documentName}`;
    const block = `${header}\n${chunk.content}`;
    if (context.length + block.length + 2 > limit) break;
    context += (context ? '\n\n' : '') + block;
  }

  return context;
}
