import { chatCompletions } from './openai-client';
import { analyzeAndExpandQuery, getRetrievalConfig } from './query-analysis';
import { compressChunksForContext } from './context-compression';
import { evaluateResponse, logEvaluation } from './evaluation';
import { createTimer, logMetric } from './observability';
import { Citation, retrieveRelevantChunks } from './rag';

const TYPE_HINTS: Record<string, string> = {
  structure:
    'The user wants document structure (chapters, sections, table of contents). List what you find clearly.',
  coverage:
    'The user asks whether a topic is covered. Search the content for the topic and any related chapter/section titles. Answer yes/no with evidence.',
  summary:
    'The user wants a summary. Synthesize the main themes, topics, and purpose from the content.',
  factual:
    'The user wants a specific fact or explanation. Answer precisely from the content.',
  comparison:
    'The user wants a comparison. Contrast the relevant parts found in the content.',
  general:
    'Answer the question directly using the document content.',
};

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

function buildMessages(
  question: string,
  ragContext: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  documentName: string | undefined,
  queryType: string
) {
  const scope = documentName
    ? `Document: "${documentName}".`
    : 'The user may be asking about any of their uploaded documents.';

  return [
    {
      role: 'system' as const,
      content: `You are an expert document analyst. ${scope}

${TYPE_HINTS[queryType] ?? TYPE_HINTS.general}

Below is text from the user's document(s), numbered as [1], [2], etc.
Answer confidently from this content. Cite sources using [1], [2] notation inline.
Never say you lack access or cannot read the file.
If a topic is not found, say so and mention related topics that ARE present.

Document content:
${ragContext}`,
    },
    ...history.slice(-3).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: (msg.content ?? '').slice(0, 1200),
    })),
    { role: 'user' as const, content: question },
  ];
}

export async function askAboutDocuments(
  userId: string,
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  documentId?: string | null,
  category?: string | null
): Promise<ChatResponse> {
  const chatTimer = createTimer('chat');
  const analysis = await analyzeAndExpandQuery(question);
  const config = getRetrievalConfig(analysis);

  const { chunks, citations } = await retrieveRelevantChunks(userId, question, {
    documentId,
    category,
    topK: config.topK,
    analysis,
  });

  const { context: ragContext, originalChars, compressedChars } = compressChunksForContext(
    chunks,
    config.maxContextChars
  );

  logMetric('context_compression', {
    originalChars,
    compressedChars,
    savingsPct:
      originalChars > 0 ? Math.round((1 - compressedChars / originalChars) * 100) : 0,
  });

  const documentName =
    documentId && chunks[0] ? chunks[0].documentName : undefined;

  const messages = buildMessages(
    question,
    ragContext,
    history,
    documentName,
    analysis.type
  );

  const gptTimer = createTimer('gpt_completion');
  const answer = await chatCompletions(messages, config.maxTokens);
  gptTimer.end({ queryType: analysis.type });

  const evaluation = evaluateResponse(answer, citations, chunks, question);
  logEvaluation('chat_response', evaluation, {
    documentId: documentId ?? null,
    queryType: analysis.type,
    rewritten: Boolean(analysis.rewrittenQuery),
  });

  chatTimer.end({
    citationCount: citations.length,
    groundingPassed: evaluation.metrics.groundingPassed,
    hitRate: evaluation.metrics.hitRate,
  });

  return { answer, citations };
}

export function generateConversationTitle(question: string): string {
  const cleaned = question.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 57) + '...';
}
