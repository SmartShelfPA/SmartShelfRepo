import { API_BASE_URL } from '@/services/api';
import type { IgcsTextbook } from '@/src/types/igcse';

function bundledPdfUrl(bookId: string): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  return `${base}/v1/igcse/bundled/${encodeURIComponent(bookId.trim())}/pdf/`;
}

/** Mirrors ``SmartShelfRepo/bundled-igcse/manifest.json`` (repo-shipped PDFs). */
const BUNDLED_IGCS_CATALOG: Omit<IgcsTextbook, 'epubUrl'>[] = [
  {
    id: 'bundled-medical-biochemistry',
    title: 'Textbook of Medical Biochemistry',
    subject: 'Biology',
    author: 'MN Chatterjea',
    description: 'A comprehensive medical biochemistry textbook covering all major topics.',
  },
];

export function isBundledIgcsBookId(bookId: string): boolean {
  return bookId.trim().startsWith('bundled-');
}

export function getBundledIgcsTextbooks(): IgcsTextbook[] {
  return BUNDLED_IGCS_CATALOG.map((book) => ({
    ...book,
    epubUrl: bundledPdfUrl(book.id),
  }));
}

export function getBundledIgcsTextbookById(bookId: string): IgcsTextbook | null {
  const id = bookId.trim();
  const meta = BUNDLED_IGCS_CATALOG.find((b) => b.id === id);
  if (!meta) return null;
  return { ...meta, epubUrl: bundledPdfUrl(id) };
}
