import type { EpubBookmark, EpubHighlight, EpubNote } from '@/src/types/igcse';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** DRF list or paginated `{ results: [] }`. */
export function parseJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const obj = asRecord(raw);
  if (!obj) return [];
  const nested = obj.results ?? obj.items ?? obj.data;
  return Array.isArray(nested) ? nested : [];
}

export function mapApiBookmarkToEpub(raw: unknown, bookId: string): EpubBookmark | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = pickString(o.id);
  if (!id) return null;
  const label = pickString(o.label) ?? '';
  return {
    id,
    bookId,
    label,
    createdAt: pickString(o.created_at) ?? new Date().toISOString(),
    location: {
      startCfi: pickString(o.start_cfi),
      endCfi: pickString(o.end_cfi),
      chapterHref: pickString(o.chapter_href),
      excerpt: pickString(o.excerpt),
    },
  };
}

export function mapApiHighlightToEpub(raw: unknown, bookId: string): EpubHighlight | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = pickString(o.id);
  if (!id) return null;
  return {
    id,
    bookId,
    color: pickString(o.color) ?? '#FFD54F',
    createdAt: pickString(o.created_at) ?? new Date().toISOString(),
    location: {
      startCfi: pickString(o.start_cfi),
      endCfi: pickString(o.end_cfi),
      chapterHref: pickString(o.chapter_href),
      excerpt: pickString(o.excerpt),
    },
    fallbackNote: pickString(o.fallback_note),
  };
}

export function mapApiNoteToEpub(raw: unknown, bookId: string): EpubNote | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = pickString(o.id);
  if (!id) return null;
  const body = pickString(o.body) ?? '';
  return {
    id,
    bookId,
    body,
    createdAt: pickString(o.created_at) ?? new Date().toISOString(),
    location: {
      startCfi: pickString(o.start_cfi),
    },
  };
}
