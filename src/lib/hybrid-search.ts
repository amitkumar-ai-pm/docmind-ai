export const HYBRID_CANDIDATE_K = 20;
export const RERANK_TOP_K = 5;

export interface RankedItem {
  id: string;
  vectorRank: number | null;
  bm25Rank: number | null;
  vectorScore: number;
  bm25Score: number;
  rrfScore: number;
}

/** Reciprocal Rank Fusion — merges vector + BM25 rankings. */
export function reciprocalRankFusion(
  vectorResults: { id: string; score: number }[],
  bm25Results: { id: string; score: number }[],
  k = 60
): RankedItem[] {
  const map = new Map<string, RankedItem>();

  vectorResults.forEach((r, i) => {
    map.set(r.id, {
      id: r.id,
      vectorRank: i + 1,
      bm25Rank: null,
      vectorScore: r.score,
      bm25Score: 0,
      rrfScore: 1 / (k + i + 1),
    });
  });

  bm25Results.forEach((r, i) => {
    const existing = map.get(r.id);
    const rrfContrib = 1 / (k + i + 1);

    if (existing) {
      existing.bm25Rank = i + 1;
      existing.bm25Score = r.score;
      existing.rrfScore += rrfContrib;
    } else {
      map.set(r.id, {
        id: r.id,
        vectorRank: null,
        bm25Rank: i + 1,
        vectorScore: 0,
        bm25Score: r.score,
        rrfScore: rrfContrib,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}
