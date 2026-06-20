import { prisma } from './prisma';
import { cosineSimilarity, deserializeEmbedding } from './embeddings';

const EMBEDDING_DIM = 1536;

export function isPgVectorEnabled(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  return url.startsWith('postgresql') && process.env.USE_PGVECTOR === 'true';
}

/** Ensure pgvector extension exists (PostgreSQL only). */
export async function initPgVector(): Promise<void> {
  if (!isPgVectorEnabled()) return;

  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (error) {
    console.warn('pgvector extension setup skipped:', error);
  }
}

export interface VectorSearchResult {
  id: string;
  score: number;
}

/** Cosine similarity search — works on SQLite (JSON) and Postgres (JSON fallback). */
export function vectorSearchLocal(
  chunks: { id: string; embedding: string }[],
  queryEmbedding: number[],
  topK: number
): VectorSearchResult[] {
  const results: VectorSearchResult[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding || chunk.embedding === '[]') continue;
    try {
      const emb = deserializeEmbedding(chunk.embedding);
      if (emb.length !== EMBEDDING_DIM && emb.length > 0) {
        const score = cosineSimilarity(queryEmbedding, emb);
        results.push({ id: chunk.id, score });
      } else if (emb.length === EMBEDDING_DIM) {
        const score = cosineSimilarity(queryEmbedding, emb);
        results.push({ id: chunk.id, score });
      }
    } catch {
      continue;
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Native pgvector search when enabled. */
export async function vectorSearchPg(
  queryEmbedding: number[],
  userId: string,
  documentId: string | null,
  topK: number
): Promise<VectorSearchResult[]> {
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const docFilter = documentId
    ? `AND d.id = '${documentId.replace(/'/g, "''")}'`
    : '';

  try {
    const rows = await prisma.$queryRawUnsafe<
      { id: string; score: number }[]
    >(
      `SELECT c.id, 1 - (c.embedding_vec <=> $1::vector) AS score
       FROM "DocumentChunk" c
       JOIN "Document" d ON d.id = c."documentId"
       WHERE d."userId" = $2 ${docFilter}
         AND c.embedding_vec IS NOT NULL
       ORDER BY c.embedding_vec <=> $1::vector
       LIMIT $3`,
      vectorStr,
      userId,
      topK
    );

    return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
  } catch {
    return [];
  }
}
