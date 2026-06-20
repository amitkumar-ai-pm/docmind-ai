import { attachChunkOffsets } from './text-offsets';

export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 250;
export const TOP_K_CHUNKS = 10;
export const MAX_CHUNKS_PER_DOCUMENT = 400;
export const CURRENT_CHUNK_VERSION = 5;

export interface ParsedChunk {
  content: string;
  chapterTitle: string | null;
  sectionTitle: string | null;
  chunkType: 'toc' | 'section' | 'body';
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  lineStart: number;
  lineEnd: number;
  pageNumber: number | null;
}

const CHAPTER_PATTERNS = [
  /^chapter\s+[\divx\d]+/im,
  /^part\s+[ivx\d]+/im,
  /^book\s+[\divx\d]+/im,
];

const SECTION_PATTERNS = [
  /^section\s+\d+/im,
  /^appendix\s+[a-z\d]/im,
  /^\d+[\.\)]\s+[A-Z]/m,
  /^[A-Z][A-Za-z\s]{2,50}$/m,
];

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\f/g, '\n\n').trim();
}

function detectChapterTitle(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return null;
  if (CHAPTER_PATTERNS.some((p) => p.test(trimmed))) return trimmed;
  return null;
}

function detectSectionTitle(block: string): string | null {
  const firstLine = block.split('\n')[0]?.trim() ?? '';
  if (firstLine.length < 3 || firstLine.length > 120) return null;

  const lower = firstLine.toLowerCase();
  if (
    lower.includes('table of contents') ||
    /^chapter\s+\d/i.test(firstLine) ||
    /^section\s+\d/i.test(firstLine) ||
    /^part\s+/i.test(firstLine) ||
    /^appendix/i.test(firstLine) ||
    /^\d+[\.\)]\s+\S/.test(firstLine)
  ) {
    return firstLine;
  }

  return null;
}

interface Chapter {
  title: string | null;
  content: string;
}

interface Section {
  title: string | null;
  content: string;
}

interface Paragraph {
  content: string;
}

function splitIntoChapters(text: string): Chapter[] {
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    const content = currentLines.join('\n').trim();
    if (content) chapters.push({ title: currentTitle, content });
    currentLines = [];
  }

  for (const line of lines) {
    const chapterTitle = detectChapterTitle(line);
    if (chapterTitle && currentLines.length > 0) {
      flush();
      currentTitle = chapterTitle;
      currentLines.push(line);
    } else {
      if (!currentTitle && chapterTitle) currentTitle = chapterTitle;
      currentLines.push(line);
    }
  }

  flush();
  return chapters.length > 0 ? chapters : [{ title: null, content: text }];
}

function splitIntoSections(text: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    const content = currentLines.join('\n').trim();
    if (content) sections.push({ title: currentTitle, content });
    currentLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const isHeader =
      SECTION_PATTERNS.some((p) => p.test(trimmed)) ||
      (trimmed.length > 0 &&
        trimmed.length < 80 &&
        trimmed === trimmed.toUpperCase() &&
        /[A-Z]/.test(trimmed) &&
        !/^\d+$/.test(trimmed));

    if (isHeader && currentLines.length > 0) {
      flush();
      currentTitle = trimmed;
      currentLines.push(line);
    } else {
      if (currentLines.length === 0 && !currentTitle) {
        const title = detectSectionTitle(trimmed + '\n' + (lines[i + 1] ?? ''));
        if (title) currentTitle = title;
      }
      currentLines.push(line);
    }
  }

  flush();
  return sections.length > 0 ? sections : [{ title: null, content: text }];
}

function splitIntoParagraphs(content: string): Paragraph[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => ({ content: p }));
}

function inferChunkType(
  sectionTitle: string | null,
  content: string
): 'toc' | 'section' | 'body' {
  const lower = (sectionTitle ?? content).toLowerCase();
  if (lower.includes('table of contents') || content.startsWith('[Table of Contents]')) return 'toc';
  if (sectionTitle) return 'section';
  return 'body';
}

const EMPTY_OFFSETS = {
  startOffset: 0,
  endOffset: 0,
  lineStart: 1,
  lineEnd: 1,
  pageNumber: null as number | null,
};

function estimatePageNumber(fullText: string, probe: string): number | null {
  const idx = fullText.indexOf(probe.slice(0, 60));
  if (idx < 0) return null;
  const formFeeds = fullText.slice(0, idx).match(/\f/g);
  return (formFeeds?.length ?? 0) + 1;
}

function chunkParagraphs(
  paragraphs: Paragraph[],
  chapterTitle: string | null,
  sectionTitle: string | null,
  fullText: string,
  startIndex: number
): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let buffer = '';
  let index = startIndex;

  function pushChunk(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;

    let chunkContent = trimmed;
    const label = sectionTitle ?? chapterTitle;
    if (label && !chunkContent.toLowerCase().includes(label.toLowerCase().slice(0, 20))) {
      chunkContent = `[${label}]\n${chunkContent}`;
    }

    chunks.push({
      content: chunkContent,
      chapterTitle,
      sectionTitle,
      chunkType: inferChunkType(sectionTitle, chunkContent),
      chunkIndex: index++,
      ...EMPTY_OFFSETS,
      pageNumber: estimatePageNumber(fullText, trimmed),
    });
  }

  for (const para of paragraphs) {
    const next = buffer ? `${buffer}\n\n${para.content}` : para.content;
    if (next.length <= CHUNK_SIZE) {
      buffer = next;
      continue;
    }

    if (buffer) pushChunk(buffer);

    if (para.content.length <= CHUNK_SIZE) {
      buffer = para.content;
    } else {
      // Fall back to sentence-boundary splits for oversized paragraphs
      let start = 0;
      while (start < para.content.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
        let end = Math.min(start + CHUNK_SIZE, para.content.length);
        if (end < para.content.length) {
          const slice = para.content.slice(start, end);
          const breakAt = Math.max(
            slice.lastIndexOf('\n'),
            slice.lastIndexOf('. '),
            slice.lastIndexOf('? '),
            slice.lastIndexOf('! ')
          );
          if (breakAt > CHUNK_SIZE * 0.4) end = start + breakAt + 1;
        }
        pushChunk(para.content.slice(start, end));
        if (end >= para.content.length) break;
        start = Math.max(end - CHUNK_OVERLAP, start + 1);
      }
      buffer = '';
    }
  }

  if (buffer) pushChunk(buffer);
  return chunks;
}

export function extractSectionHeaders(text: string): string[] {
  const normalized = normalizeText(text);
  const headers = new Set<string>();

  for (const chapter of splitIntoChapters(normalized)) {
    if (chapter.title) headers.add(chapter.title);
    for (const section of splitIntoSections(chapter.content)) {
      if (section.title) headers.add(section.title);
    }
  }

  return [...headers].slice(0, 100);
}

export function chunkText(text: string): ParsedChunk[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const allChunks: ParsedChunk[] = [];
  let index = 0;

  for (const chapter of splitIntoChapters(normalized)) {
    const sections = splitIntoSections(chapter.content);

    for (const section of sections) {
      const paragraphs = splitIntoParagraphs(section.content);
      const sectionChunks = chunkParagraphs(
        paragraphs,
        chapter.title,
        section.title,
        normalized,
        index
      );

      for (const chunk of sectionChunks) {
        allChunks.push({ ...chunk, chunkIndex: index++ });
        if (allChunks.length >= MAX_CHUNKS_PER_DOCUMENT) {
          return attachChunkOffsets(normalized, allChunks);
        }
      }
    }
  }

  return attachChunkOffsets(normalized, allChunks);
}

/** Extract a dedicated TOC block when present in raw text. */
export function extractTableOfContents(text: string): string | null {
  const normalized = normalizeText(text);
  const patterns = [
    /(?:table\s+of\s+contents?|contents)\s*\n([\s\S]{200,12000}?)(?:\n\n[A-Z][^\n]{0,60}\n|\nchapter\s+\d)/i,
    /(?:table\s+of\s+contents?|contents)\s*\n([\s\S]{200,12000})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1] && match[1].trim().length > 100) {
      return match[1].trim();
    }
  }

  return null;
}
