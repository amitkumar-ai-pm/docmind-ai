export function lineAtOffset(text: string, offset: number): number {
  let line = 1;
  const end = Math.min(Math.max(0, offset), text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

export function offsetAtLine(text: string, lineNumber: number): number {
  if (lineNumber <= 1) return 0;
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      if (line === lineNumber) return i + 1;
    }
  }
  return text.length;
}

export interface ChunkWithOffsets {
  content: string;
  startOffset: number;
  endOffset: number;
  lineStart: number;
  lineEnd: number;
}

/** Map chunk text back to character offsets in the full extracted document. */
export function attachChunkOffsets<T extends { content: string }>(
  fullText: string,
  chunks: T[]
): (T & ChunkWithOffsets)[] {
  let searchFrom = 0;

  return chunks.map((chunk) => {
    const contentForSearch = chunk.content.replace(/^\[[^\]]+\]\n/, '').trim();
    const probes = [
      contentForSearch.slice(0, 120),
      contentForSearch.slice(0, 60),
      contentForSearch.slice(0, 30),
    ].filter((p) => p.length >= 12);

    let start = -1;
    for (const probe of probes) {
      start = fullText.indexOf(probe, searchFrom);
      if (start >= 0) break;
      start = fullText.indexOf(probe);
      if (start >= 0) break;
    }

    if (start < 0) {
      start = searchFrom;
    }

    const end = Math.min(
      start + Math.max(contentForSearch.length, 1),
      fullText.length
    );
    searchFrom = Math.max(searchFrom, end - 50);

    return {
      ...chunk,
      startOffset: start,
      endOffset: end,
      lineStart: lineAtOffset(fullText, start),
      lineEnd: lineAtOffset(fullText, end),
    };
  });
}

export interface ReferenceLine {
  number: number;
  text: string;
  highlighted: boolean;
}

export function buildReferenceLines(
  fullText: string,
  startOffset: number,
  endOffset: number,
  contextLines = 25
): ReferenceLine[] {
  const lineStart = lineAtOffset(fullText, startOffset);
  const lineEnd = lineAtOffset(fullText, endOffset);
  const fromLine = Math.max(1, lineStart - contextLines);
  const toLine = lineEnd + contextLines;

  const lines: ReferenceLine[] = [];
  let currentLine = 1;
  let lineStartOffset = 0;

  for (let i = 0; i <= fullText.length; i++) {
    const isEol = i === fullText.length || fullText[i] === '\n';

    if (isEol) {
      if (currentLine >= fromLine && currentLine <= toLine) {
        const lineText = fullText.slice(lineStartOffset, i);
        const lineEndOffset = i;
        const highlighted =
          lineEndOffset > startOffset && lineStartOffset < endOffset;

        lines.push({
          number: currentLine,
          text: lineText,
          highlighted,
        });
      }

      if (currentLine > toLine) break;

      currentLine++;
      lineStartOffset = i + 1;
    }
  }

  return lines;
}
