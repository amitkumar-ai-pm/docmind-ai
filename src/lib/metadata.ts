import mammoth from 'mammoth';
import { extractSectionHeaders } from './chunking';

export interface DocumentMetadata {
  title: string | null;
  fileType: string;
  author: string | null;
  sectionHeaders: string[];
  pageCount: number | null;
  uploadDate: string;
  category: string;
  sourceFilename: string;
}

function inferFileType(filename: string, mimeType: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (ext === '.pdf' || mimeType === 'application/pdf') return 'PDF';
  if (ext === '.docx' || mimeType.includes('wordprocessingml')) return 'Word';
  if (ext === '.doc') return 'Word (legacy)';
  if (ext === '.csv' || mimeType.includes('csv')) return 'CSV';
  if (ext === '.xlsx' || ext === '.xls' || mimeType.includes('spreadsheet')) return 'Excel';
  return ext.replace('.', '').toUpperCase() || 'Unknown';
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
}

export async function extractDocumentMetadata(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  extractedText: string,
  category: string
): Promise<DocumentMetadata> {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  let title: string | null = titleFromFilename(filename);
  let author: string | null = null;
  let pageCount: number | null = null;

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      const info = data.info ?? {};
      title = (info.Title as string) || title;
      author = (info.Author as string) || null;
      pageCount = data.numpages ?? null;
    } catch {
      pageCount = (extractedText.match(/\f/g) ?? []).length + 1;
    }
  }

  if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.messages.length === 0 && title) {
        // mammoth has no rich metadata API; keep filename-derived title
      }
    } catch {
      // keep defaults
    }
  }

  const sectionHeaders = extractSectionHeaders(extractedText);

  return {
    title,
    fileType: inferFileType(filename, mimeType),
    author,
    sectionHeaders,
    pageCount,
    uploadDate: new Date().toISOString(),
    category,
    sourceFilename: filename,
  };
}

export function serializeMetadata(metadata: DocumentMetadata): string {
  return JSON.stringify(metadata);
}

export function parseMetadata(raw: string | null | undefined): DocumentMetadata | null {
  if (!raw || raw === '{}') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DocumentMetadata>;
    return {
      title: parsed.title ?? null,
      fileType: parsed.fileType ?? 'Unknown',
      author: parsed.author ?? null,
      sectionHeaders: Array.isArray(parsed.sectionHeaders) ? parsed.sectionHeaders : [],
      pageCount: parsed.pageCount ?? null,
      uploadDate: parsed.uploadDate ?? '',
      category: parsed.category ?? 'other',
      sourceFilename: parsed.sourceFilename ?? '',
    };
  } catch {
    return null;
  }
}

export function metadataSearchText(metadata: DocumentMetadata | null): string {
  if (!metadata) return '';
  const headers = metadata.sectionHeaders ?? [];
  return [
    metadata.title,
    metadata.author,
    metadata.fileType,
    metadata.category,
    ...headers.slice(0, 20),
  ]
    .filter(Boolean)
    .join(' ');
}
