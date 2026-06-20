function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z0-9][a-z0-9-]{1,}\b/g) ?? [];
}

export class BM25Index {
  private docs: string[][] = [];
  private docLengths: number[] = [];
  private avgDocLength = 0;
  private df = new Map<string, number>();
  private readonly k1 = 1.5;
  private readonly b = 0.75;

  constructor(texts: string[]) {
    this.docs = texts.map(tokenize);
    this.docLengths = this.docs.map((d) => d.length);
    this.avgDocLength =
      this.docLengths.reduce((a, b) => a + b, 0) / (this.docLengths.length || 1);

    for (const doc of this.docs) {
      const seen = new Set<string>();
      for (const term of doc) {
        if (!seen.has(term)) {
          this.df.set(term, (this.df.get(term) ?? 0) + 1);
          seen.add(term);
        }
      }
    }
  }

  score(query: string): number[] {
    const qTerms = tokenize(query);
    const N = this.docs.length;
    const scores = new Array(N).fill(0);

    for (const term of qTerms) {
      const df = this.df.get(term) ?? 0;
      if (df === 0) continue;

      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

      for (let i = 0; i < N; i++) {
        const tf = this.docs[i].filter((t) => t === term).length;
        if (tf === 0) continue;

        const len = this.docLengths[i];
        const num = tf * (this.k1 + 1);
        const den = tf + this.k1 * (1 - this.b + this.b * (len / this.avgDocLength));
        scores[i] += idf * (num / den);
      }
    }

    return scores;
  }
}

export function bm25TopK(
  texts: string[],
  query: string,
  k: number
): { index: number; score: number }[] {
  if (texts.length === 0) return [];

  const index = new BM25Index(texts);
  const scores = index.score(query);

  return scores
    .map((score, idx) => ({ index: idx, score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
