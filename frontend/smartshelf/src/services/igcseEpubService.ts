/**
 * IGCSE EPUB reader ↔ Django (`learning.igcse_urls` under `/api/v1/igcse/`).
 *
 * - Books: `igcseBooks` helpers
 * - Progress: `PUT /v1/igcse/books/{uuid}/progress/`
 * - Bookmarks / highlights / notes: list + create + delete (+ note PATCH)
 */
import { apiRequest } from '@/services/api';
import {
  fetchIgcsTextbookById,
  fetchIgcsTextbooks,
  syncIgcsReaderProgress,
  type ReaderProgressPayload,
} from '@/src/api/igcseBooks';
import {
  mapApiBookmarkToEpub,
  mapApiHighlightToEpub,
  mapApiNoteToEpub,
  parseJsonArray,
} from '@/src/api/mappers/igcseReaderFromApi';
import type {
  EpubBookmark,
  EpubHighlight,
  EpubLocationRef,
  EpubNote,
  IgcsTextbook,
} from '@/src/types/igcse';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBackendIgcsBookId(bookId: string): boolean {
  return UUID_RE.test(bookId.trim());
}

export function isBackendIgcsEntityId(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export async function getIGCSEBooks(): Promise<IgcsTextbook[]> {
  return fetchIgcsTextbooks();
}

export async function getIGCSEBookDetail(bookId: string): Promise<IgcsTextbook | null> {
  return fetchIgcsTextbookById(bookId);
}

export async function saveReadingProgress(payload: ReaderProgressPayload): Promise<boolean> {
  return syncIgcsReaderProgress(payload);
}

export type SaveBookmarkPayload = {
  bookId: string;
  label: string;
  location: EpubLocationRef;
};

export async function saveBookmarkRemote(
  payload: SaveBookmarkPayload
): Promise<EpubBookmark | null> {
  if (!isBackendIgcsBookId(payload.bookId)) return null;
  try {
    const body = {
      label: payload.label,
      start_cfi: payload.location.startCfi ?? '',
      end_cfi: payload.location.endCfi ?? '',
      chapter_href: payload.location.chapterHref ?? '',
      excerpt: payload.location.excerpt ?? '',
    };
    const res = await apiRequest(
      `/v1/igcse/books/${encodeURIComponent(payload.bookId)}/bookmarks/`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    const raw = await res.json().catch(() => null);
    if (!res.ok) return null;
    return mapApiBookmarkToEpub(raw, payload.bookId);
  } catch {
    return null;
  }
}

export async function deleteBookmarkRemote(bookId: string, bookmarkId: string): Promise<boolean> {
  if (!isBackendIgcsBookId(bookId) || !isBackendIgcsEntityId(bookmarkId)) return false;
  try {
    const res = await apiRequest(
      `/v1/igcse/books/${encodeURIComponent(bookId)}/bookmarks/${encodeURIComponent(bookmarkId)}/`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type SaveNotePayload = {
  bookId: string;
  body: string;
  location: EpubLocationRef;
};

export async function saveNoteRemote(payload: SaveNotePayload): Promise<EpubNote | null> {
  if (!isBackendIgcsBookId(payload.bookId)) return null;
  try {
    const res = await apiRequest(`/v1/igcse/books/${encodeURIComponent(payload.bookId)}/notes/`, {
      method: 'POST',
      body: JSON.stringify({
        body: payload.body,
        start_cfi: payload.location.startCfi ?? '',
      }),
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok) return null;
    return mapApiNoteToEpub(raw, payload.bookId);
  } catch {
    return null;
  }
}

export async function deleteNoteRemote(bookId: string, noteId: string): Promise<boolean> {
  if (!isBackendIgcsBookId(bookId) || !isBackendIgcsEntityId(noteId)) return false;
  try {
    const res = await apiRequest(
      `/v1/igcse/books/${encodeURIComponent(bookId)}/notes/${encodeURIComponent(noteId)}/`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateNoteRemote(
  bookId: string,
  noteId: string,
  body: string
): Promise<EpubNote | null> {
  if (!isBackendIgcsBookId(bookId) || !isBackendIgcsEntityId(noteId)) return null;
  try {
    const res = await apiRequest(
      `/v1/igcse/books/${encodeURIComponent(bookId)}/notes/${encodeURIComponent(noteId)}/`,
      { method: 'PATCH', body: JSON.stringify({ body }) }
    );
    const raw = await res.json().catch(() => null);
    if (!res.ok) return null;
    return mapApiNoteToEpub(raw, bookId);
  } catch {
    return null;
  }
}

export type SaveHighlightPayload = {
  bookId: string;
  color: string;
  location: EpubLocationRef;
  fallbackNote?: string;
};

export async function saveHighlightRemote(payload: SaveHighlightPayload): Promise<EpubHighlight | null> {
  if (!isBackendIgcsBookId(payload.bookId)) return null;
  try {
    const res = await apiRequest(
      `/v1/igcse/books/${encodeURIComponent(payload.bookId)}/highlights/`,
      {
        method: 'POST',
        body: JSON.stringify({
          color: payload.color,
          start_cfi: payload.location.startCfi ?? '',
          end_cfi: payload.location.endCfi ?? '',
          chapter_href: payload.location.chapterHref ?? '',
          excerpt: payload.location.excerpt ?? '',
          fallback_note: payload.fallbackNote ?? '',
        }),
      }
    );
    const raw = await res.json().catch(() => null);
    if (!res.ok) return null;
    return mapApiHighlightToEpub(raw, payload.bookId);
  } catch {
    return null;
  }
}

export async function deleteHighlightRemote(bookId: string, highlightId: string): Promise<boolean> {
  if (!isBackendIgcsBookId(bookId) || !isBackendIgcsEntityId(highlightId)) return false;
  try {
    const res = await apiRequest(
      `/v1/igcse/books/${encodeURIComponent(bookId)}/highlights/${encodeURIComponent(highlightId)}/`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type IgcsReaderAnnotationsBundle = {
  bookmarks: EpubBookmark[];
  highlights: EpubHighlight[];
  notes: EpubNote[];
};

async function fetchBookmarkList(bookId: string): Promise<EpubBookmark[]> {
  const res = await apiRequest(`/v1/igcse/books/${encodeURIComponent(bookId)}/bookmarks/`, {
    method: 'GET',
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) return [];
  return parseJsonArray(raw)
    .map((row) => mapApiBookmarkToEpub(row, bookId))
    .filter((b): b is EpubBookmark => b != null);
}

async function fetchHighlightList(bookId: string): Promise<EpubHighlight[]> {
  const res = await apiRequest(`/v1/igcse/books/${encodeURIComponent(bookId)}/highlights/`, {
    method: 'GET',
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) return [];
  return parseJsonArray(raw)
    .map((row) => mapApiHighlightToEpub(row, bookId))
    .filter((h): h is EpubHighlight => h != null);
}

async function fetchNoteList(bookId: string): Promise<EpubNote[]> {
  const res = await apiRequest(`/v1/igcse/books/${encodeURIComponent(bookId)}/notes/`, {
    method: 'GET',
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) return [];
  return parseJsonArray(raw)
    .map((row) => mapApiNoteToEpub(row, bookId))
    .filter((n): n is EpubNote => n != null);
}

/** Loads bookmarks, highlights, and notes from Django (parallel GETs). */
export async function fetchIgcsReaderAnnotationsBundle(
  bookId: string
): Promise<IgcsReaderAnnotationsBundle | null> {
  if (!isBackendIgcsBookId(bookId)) return null;
  try {
    const [bookmarks, highlights, notes] = await Promise.all([
      fetchBookmarkList(bookId),
      fetchHighlightList(bookId),
      fetchNoteList(bookId),
    ]);
    return { bookmarks, highlights, notes };
  } catch {
    return null;
  }
}
