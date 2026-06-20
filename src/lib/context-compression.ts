import { RetrievedChunk } from './rag';

const MAX_CHUNK_CHARS = 900;
const HEAD_CHARS = 500;
const TAIL_CHARS = 250;

/** Compress top-K chunks while preserving citation anchors [1], [2], etc. */
export function compressChunksForContext(
  chunks: RetrievedChunk[],
  maxTotalChars: number
): { context: string; originalChars: number; compressedChars: number } {
  const meaningful = chunks.filter((c) => (c.content ?? '').trim().length > 20);
  if (meaningful.length === 0) {
    return {
      context: 'No document text could be extracted.',
      originalChars: 0,
      compressedChars: 0,
    };
  }

  let context = '';
  let originalChars = 0;
  let compressedChars = 0;

  for (const chunk of meaningful) {
    const header = chunk.sectionTitle
      ? `[${chunk.citationIndex}] ${chunk.documentName} — ${chunk.sectionTitle}`
      : `[${chunk.citationIndex}] ${chunk.documentName}`;

    const body = compressChunkBody(chunk.content ?? '');
    originalChars += (chunk.content ?? '').length;
    compressedChars += body.length;

    const block = `${header}\n${body}`;
    if (context.length + block.length + 2 > maxTotalChars) break;
    context += (context ? '\n\n' : '') + block;
  }

  return { context, originalChars, compressedChars };
}

function compressChunkBody(content: string | null | undefined): string {
  const trimmed = (content ?? '').trim();
  if (trimmed.length <= MAX_CHUNK_CHARS) return trimmed;

  const head = trimmed.slice(0, HEAD_CHARS).trim();
  const tail = trimmed.slice(-TAIL_CHARS).trim();
  return `${head}\n[... excerpt compressed ...]\n${tail}`;
}
