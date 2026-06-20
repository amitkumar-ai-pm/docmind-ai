export type QueryType =
  | 'structure'
  | 'coverage'
  | 'summary'
  | 'factual'
  | 'comparison'
  | 'general';

export interface QueryAnalysis {
  type: QueryType;
  terms: string[];
  phrases: string[];
  topicTerms: string[];
  expandedTerms: string[];
  rewrittenQuery?: string;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'don', 'now', 'show', 'tell', 'give', 'list', 'explain', 'describe',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'it', 'its', 'my', 'your', 'his', 'her', 'their', 'our', 'me',
  'him', 'them', 'us', 'you', 'about', 'book', 'document', 'file',
  'please', 'want', 'know', 'like', 'get',
]);

const TERM_EXPANSIONS: Record<string, string[]> = {
  ml: ['machine learning', 'learning'],
  ai: ['artificial intelligence'],
  stats: ['statistics', 'statistical'],
  viz: ['visualization', 'visualisation'],
  ts: ['time series'],
  'time series': ['time-series', 'timeseries', 'forecasting'],
  regression: ['linear model', 'logistic'],
  classification: ['classifier', 'classify'],
  clustering: ['cluster', 'k-means', 'kmeans'],
  numpy: ['np', 'array'],
  pandas: ['dataframe', 'data frame'],
  matplotlib: ['plotting', 'plot'],
  severance: ['termination benefits', 'separation pay', 'exit package', 'redundancy pay'],
  termination: ['severance', 'dismissal', 'layoff', 'resignation'],
  salary: ['compensation', 'pay', 'wages', 'remuneration'],
  benefits: ['perks', 'entitlements', 'compensation package'],
  contract: ['agreement', 'terms', 'clause', 'covenant'],
  liability: ['indemnity', 'damages', 'obligation', 'responsibility'],
  privacy: ['data protection', 'confidentiality', 'gdpr', 'personal data'],
};

function classifyQuery(question: string): QueryType {
  const q = question.toLowerCase();

  if (
    /table of contents|list (?:of |all )?chapters|chapter list|all chapters|outline|structure of|sections in|show.*contents|what chapters|index of/i.test(q)
  ) {
    return 'structure';
  }

  if (
    /does .+ cover|is .+ covered|is there a (?:chapter|section) (?:on|about)|talk about|mention|discuss/i.test(q)
  ) {
    return 'coverage';
  }

  if (
    /summarize|summary|overview|what is this (?:book|document) about|main points|key (?:points|takeaways)|tl;dr|tldr/i.test(q)
  ) {
    return 'summary';
  }

  if (/compare|difference between|versus|vs\.?|contrast/i.test(q)) {
    return 'comparison';
  }

  if (/how (?:to|do|does)|what is|define|explain|why does|when should|where is/i.test(q)) {
    return 'factual';
  }

  return 'general';
}

function extractPhrases(question: string): string[] {
  const phrases: string[] = [];
  const q = question.toLowerCase();

  const quoted = question.match(/"([^"]+)"|'([^']+)'/g);
  if (quoted) phrases.push(...quoted.map((s) => s.replace(/['"]/g, '').toLowerCase()));

  const patterns = [
    /(?:does .+ cover|section on|chapter on|talk about|explain|define|what is|how does)\s+(.+?)\??$/i,
    /time\s+series(?:\s+analysis)?/i,
    /machine\s+learning/i,
    /linear\s+regression/i,
    /logistic\s+regression/i,
    /neural\s+network/i,
    /decision\s+tree/i,
    /random\s+forest/i,
    /cross[\s-]validation/i,
    /table\s+of\s+contents/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match) {
      phrases.push((match[1] ?? match[0]).toLowerCase().trim());
    }
  }

  return [...new Set(phrases.filter((p) => p.length > 2))];
}

function extractTopicTerms(question: string, type: QueryType): string[] {
  const phrases = extractPhrases(question);
  const terms = new Set<string>();

  for (const phrase of phrases) {
    phrase.split(/\W+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w)).forEach((w) => terms.add(w));
    if (phrase.includes(' ')) terms.add(phrase);
  }

  if (type === 'coverage') {
    const patterns = [
      /does (?:this |the )?(?:book|document) cover (.+?)\??$/i,
      /is there a (?:chapter|section) (?:on|about) (.+?)\??$/i,
      /does .+ (?:talk about|discuss|mention|cover) (.+?)\??$/i,
      /is (.+?) covered/i,
    ];
    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match?.[1]) {
        match[1]
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
          .forEach((w) => terms.add(w));
        terms.add(match[1].toLowerCase().trim());
      }
    }
  }

  return [...terms];
}

function extractTerms(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  return [...new Set(words)];
}

function expandTerms(terms: string[], phrases: string[]): string[] {
  const expanded = new Set<string>(terms);

  for (const term of terms) {
    const extras = TERM_EXPANSIONS[term];
    if (extras) extras.forEach((e) => expanded.add(e));
  }

  for (const phrase of phrases) {
    const extras = TERM_EXPANSIONS[phrase];
    if (extras) extras.forEach((e) => expanded.add(e));
    phrase.split(/\s+/).forEach((w) => expanded.add(w));
  }

  return [...expanded];
}

export function analyzeQuery(question: string): QueryAnalysis {
  const type = classifyQuery(question);
  const phrases = extractPhrases(question);
  const terms = extractTerms(question);
  const topicTerms = extractTopicTerms(question, type);
  const expandedTerms = expandTerms([...terms, ...topicTerms], phrases);

  return { type, terms, phrases, topicTerms, expandedTerms };
}

export function getRetrievalConfig(analysis: QueryAnalysis): {
  topK: number;
  maxContextChars: number;
  maxTokens: number;
} {
  switch (analysis.type) {
    case 'structure':
      return { topK: 5, maxContextChars: 18_000, maxTokens: 1500 };
    case 'coverage':
      return { topK: 5, maxContextChars: 16_000, maxTokens: 1000 };
    case 'summary':
      return { topK: 5, maxContextChars: 16_000, maxTokens: 1200 };
    case 'comparison':
      return { topK: 5, maxContextChars: 14_000, maxTokens: 1000 };
    case 'factual':
      return { topK: 5, maxContextChars: 12_000, maxTokens: 900 };
    default:
      return { topK: 5, maxContextChars: 12_000, maxTokens: 800 };
  }
}

/** Expand query with synonyms and analysis terms for hybrid search. */
export function expandQuery(question: string, analysis: QueryAnalysis): string {
  const base = analysis.rewrittenQuery ?? question;
  const parts = [
    base,
    question,
    ...(analysis.phrases ?? []),
    ...(analysis.expandedTerms ?? []).slice(0, 12),
  ];
  return [...new Set(parts)].join(' ');
}

/** Optional LLM rewrite when synonym expansion is thin. */
export async function rewriteQuery(question: string, analysis: QueryAnalysis): Promise<string | null> {
  if (analysis.expandedTerms.length >= 4) return null;
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const { chatCompletions } = await import('./openai-client');
    const rewritten = await chatCompletions(
      [
        {
          role: 'system',
          content:
            'Rewrite the user question into 1-2 search-friendly lines with synonyms and related terms for document retrieval. Return only the rewritten query, no explanation.',
        },
        { role: 'user', content: question },
      ],
      120
    );
    const trimmed = rewritten.trim();
    return trimmed.length > 5 ? trimmed : null;
  } catch {
    return null;
  }
}

export async function analyzeAndExpandQuery(question: string): Promise<QueryAnalysis> {
  const analysis = analyzeQuery(question);
  const rewritten = await rewriteQuery(question, analysis);
  if (rewritten) {
    analysis.rewrittenQuery = rewritten;
    analysis.expandedTerms = [...new Set([...analysis.expandedTerms, ...extractTerms(rewritten)])];
  }
  return analysis;
}
