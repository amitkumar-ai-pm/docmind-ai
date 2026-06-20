import { parse } from 'csv-parse/sync';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text.trim();
  }

  if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (ext === '.doc' || mimeType === 'application/msword') {
    // Legacy .doc has limited support; attempt raw text extraction
    const text = buffer.toString('utf-8');
    const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length > 50) return cleaned;
    throw new Error('Legacy .doc files have limited support. Please convert to .docx.');
  }

  if (ext === '.csv' || mimeType.includes('csv')) {
    const content = buffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    if (records.length === 0) {
      return content.trim();
    }

    const headers = Object.keys(records[0]);
    const rows = records.map((row) =>
      headers.map((h) => `${h}: ${row[h] ?? ''}`).join(', ')
    );
    return [`Columns: ${headers.join(', ')}`, ...rows].join('\n');
  }

  if (ext === '.xlsx' || ext === '.xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }

    return sheets.join('\n\n').trim();
  }

  throw new Error(`Unsupported file type: ${ext || mimeType}`);
}

export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... content truncated ...]';
}
