export const MAX_DOCUMENTS = 5;
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_CONVERSATIONS = 10;

export const DOCUMENT_CATEGORIES = [
  { id: 'all', label: 'All', color: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { id: 'data-science', label: 'Data Science', color: 'bg-violet-100 text-violet-700 ring-violet-200' },
  { id: 'novel', label: 'Novel', color: 'bg-rose-100 text-rose-700 ring-rose-200' },
  { id: 'news', label: 'News', color: 'bg-sky-100 text-sky-700 ring-sky-200' },
  { id: 'business', label: 'Business', color: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { id: 'legal', label: 'Legal', color: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { id: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700 ring-gray-200' },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]['id'];

export const UPLOAD_CATEGORIES = DOCUMENT_CATEGORIES.filter((c) => c.id !== 'all');

export function getCategoryMeta(id: string) {
  return DOCUMENT_CATEGORIES.find((c) => c.id === id) ?? DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1];
}

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
] as const;

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv'] as const;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

export function isAllowedFile(filename: string, mimeType: string): boolean {
  const ext = getFileExtension(filename);
  if (ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) return true;
  return ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number]);
}

export function displayUserName(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) return name.trim();
  if (email) return email.split('@')[0];
  return 'User';
}
