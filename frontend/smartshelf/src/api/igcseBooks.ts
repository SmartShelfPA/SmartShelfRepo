import { apiRequest } from '@/services/api';
import { normalizeIgcsTextbook, normalizeIgcsTextbookList } from '@/src/api/mappers/igcseFromUnknown';
import type { IgcsTextbook } from '@/src/types/igcse';

/** Public-domain EPUB used only by dashboard mock fallbacks. */
export const MOCK_IGCSE_EPUB_URL = 'https://www.gutenberg.org/ebooks/11.epub3.images';

export class IgcsBooksFetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'IgcsBooksFetchError';
    this.status = status;
  }
}

function messageFromBody(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as Record<string, unknown>;
  const detail = typeof o.detail === 'string' ? o.detail : '';
  const error = typeof o.error === 'string' ? o.error : '';
  return [detail, error].filter(Boolean).join(' — ') || fallback;
}

/**
 * EPUB textbook catalog from Django `GET /api/v1/igcse/books/` (`learning.IgcsBookListView`).
 * Requires authentication.
 */
export async function fetchIgcsTextbooks(): Promise<IgcsTextbook[]> {
  const response = await apiRequest('/v1/igcse/books/', { method: 'GET' });
  const raw = await response.json().catch(() => null);

  if (response.status === 401 || response.status === 403) {
    throw new IgcsBooksFetchError('Sign in to load IGCSE textbooks.', response.status);
  }
  if (!response.ok) {
    throw new IgcsBooksFetchError(
      messageFromBody(raw, `Could not load textbooks (${response.status})`),
      response.status
    );
  }

  return normalizeIgcsTextbookList(raw);
}

export async function fetchIgcsTextbookById(bookId: string): Promise<IgcsTextbook | null> {
  const response = await apiRequest(`/v1/igcse/books/${encodeURIComponent(bookId)}/`, {
    method: 'GET',
  });
  const raw = await response.json().catch(() => null);

  if (response.status === 401 || response.status === 403) {
    throw new IgcsBooksFetchError('Sign in to view this textbook.', response.status);
  }
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new IgcsBooksFetchError(
      messageFromBody(raw, `Could not load textbook (${response.status})`),
      response.status
    );
  }

  return normalizeIgcsTextbook(raw, 0);
}

export type ReaderProgressPayload = {
  book_id: string;
  fraction: number;
  start_cfi?: string;
  updated_at: string;
};

/** Sync reading position with `PUT /v1/igcse/books/{uuid}/progress/` (Django `IgcsReadingProgressView`). */
export async function syncIgcsReaderProgress(payload: ReaderProgressPayload): Promise<boolean> {
  try {
    const res = await apiRequest(`/v1/igcse/books/${encodeURIComponent(payload.book_id)}/progress/`, {
      method: 'PUT',
      body: JSON.stringify({
        fraction: payload.fraction,
        start_cfi: payload.start_cfi,
        updated_at: payload.updated_at,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
