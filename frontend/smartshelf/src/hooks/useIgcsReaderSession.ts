import { useCallback, useEffect, useMemo } from 'react';

import {
  selectBookSlice,
  useIgcsReaderStore,
  type NewEpubBookmarkPayload,
  type NewEpubHighlightPayload,
  type NewEpubNotePayload,
} from '@/src/store/igcseReaderStore';
import type { EpubBookmark, EpubHighlight, EpubNote, EpubReadingProgress } from '@/src/types/igcse';

/**
 * Zustand-backed reader session for one EPUB (progress, annotations, chrome settings).
 * `setProgress` updates local state and triggers `PUT …/progress/` on Django.
 * Use `igcseEpubService` for bookmark/note/highlight HTTP and merge results via `replace*` / server pull.
 */
export function useIgcsReaderSession(bookId: string | undefined) {
  const ensureBook = useIgcsReaderStore((s) => s.ensureBook);
  const setProgressStore = useIgcsReaderStore((s) => s.setProgress);
  const hydrateProgressFromCatalogIfEmptyStore = useIgcsReaderStore(
    (s) => s.hydrateProgressFromCatalogIfEmpty
  );
  const mergeAnnotationsFromServerStore = useIgcsReaderStore((s) => s.mergeAnnotationsFromServer);
  const addBookmarkStore = useIgcsReaderStore((s) => s.addBookmark);
  const replaceBookmarkStore = useIgcsReaderStore((s) => s.replaceBookmark);
  const removeBookmarkStore = useIgcsReaderStore((s) => s.removeBookmark);
  const addHighlightStore = useIgcsReaderStore((s) => s.addHighlight);
  const replaceHighlightStore = useIgcsReaderStore((s) => s.replaceHighlight);
  const removeHighlightStore = useIgcsReaderStore((s) => s.removeHighlight);
  const addNoteStore = useIgcsReaderStore((s) => s.addNote);
  const replaceNoteStore = useIgcsReaderStore((s) => s.replaceNote);
  const removeNoteStore = useIgcsReaderStore((s) => s.removeNote);
  const updateNoteStore = useIgcsReaderStore((s) => s.updateNote);
  const setFontScaleStore = useIgcsReaderStore((s) => s.setFontScale);
  const setReaderThemeStore = useIgcsReaderStore((s) => s.setReaderTheme);

  const slice = useIgcsReaderStore((s) => (bookId ? selectBookSlice(bookId)(s) : undefined));

  useEffect(() => {
    if (bookId) ensureBook(bookId);
  }, [bookId, ensureBook]);

  const setProgress = useCallback(
    (p: EpubReadingProgress) => {
      if (bookId) setProgressStore(bookId, p);
    },
    [bookId, setProgressStore]
  );

  const hydrateProgressFromCatalogIfEmpty = useCallback(
    (catalog: { progressPercent?: number; lastReadAt?: string }) => {
      if (bookId) hydrateProgressFromCatalogIfEmptyStore(bookId, catalog);
    },
    [bookId, hydrateProgressFromCatalogIfEmptyStore]
  );

  const mergeAnnotationsFromServer = useCallback(
    (bundle: { bookmarks: EpubBookmark[]; highlights: EpubHighlight[]; notes: EpubNote[] }) => {
      if (bookId) mergeAnnotationsFromServerStore(bookId, bundle);
    },
    [bookId, mergeAnnotationsFromServerStore]
  );

  const addBookmark = useCallback(
    (b: NewEpubBookmarkPayload) => {
      if (!bookId) return '';
      return addBookmarkStore(bookId, b);
    },
    [bookId, addBookmarkStore]
  );

  const replaceBookmark = useCallback(
    (oldId: string, next: EpubBookmark) => {
      if (bookId) replaceBookmarkStore(bookId, oldId, next);
    },
    [bookId, replaceBookmarkStore]
  );

  const removeBookmark = useCallback(
    (bookmarkId: string) => {
      if (bookId) removeBookmarkStore(bookId, bookmarkId);
    },
    [bookId, removeBookmarkStore]
  );

  const addHighlight = useCallback(
    (h: NewEpubHighlightPayload) => {
      if (!bookId) return '';
      return addHighlightStore(bookId, h);
    },
    [bookId, addHighlightStore]
  );

  const replaceHighlight = useCallback(
    (oldId: string, next: EpubHighlight) => {
      if (bookId) replaceHighlightStore(bookId, oldId, next);
    },
    [bookId, replaceHighlightStore]
  );

  const removeHighlight = useCallback(
    (highlightId: string) => {
      if (bookId) removeHighlightStore(bookId, highlightId);
    },
    [bookId, removeHighlightStore]
  );

  const addNote = useCallback(
    (n: NewEpubNotePayload) => {
      if (!bookId) return '';
      return addNoteStore(bookId, n);
    },
    [bookId, addNoteStore]
  );

  const replaceNote = useCallback(
    (oldId: string, next: EpubNote) => {
      if (bookId) replaceNoteStore(bookId, oldId, next);
    },
    [bookId, replaceNoteStore]
  );

  const removeNote = useCallback(
    (noteId: string) => {
      if (bookId) removeNoteStore(bookId, noteId);
    },
    [bookId, removeNoteStore]
  );

  const updateNote = useCallback(
    (noteId: string, body: string) => {
      if (bookId) updateNoteStore(bookId, noteId, body);
    },
    [bookId, updateNoteStore]
  );

  const setFontScale = useCallback(
    (scale: number) => {
      if (bookId) setFontScaleStore(bookId, scale);
    },
    [bookId, setFontScaleStore]
  );

  const setReaderTheme = useCallback(
    (mode: 'light' | 'dark') => {
      if (bookId) setReaderThemeStore(bookId, mode);
    },
    [bookId, setReaderThemeStore]
  );

  const emptySlice = useMemo(
    () => ({
      progress: null as EpubReadingProgress | null,
      bookmarks: [] as EpubBookmark[],
      highlights: [] as EpubHighlight[],
      notes: [] as EpubNote[],
      settings: { fontScale: 1, readerTheme: 'light' as const },
    }),
    []
  );

  const safeSlice = slice ?? emptySlice;

  return useMemo(
    () => ({
      bookId,
      progress: safeSlice.progress,
      bookmarks: safeSlice.bookmarks,
      highlights: safeSlice.highlights,
      notes: safeSlice.notes,
      settings: safeSlice.settings,
      setProgress,
      hydrateProgressFromCatalogIfEmpty,
      mergeAnnotationsFromServer,
      addBookmark,
      replaceBookmark,
      removeBookmark,
      addHighlight,
      replaceHighlight,
      removeHighlight,
      addNote,
      replaceNote,
      removeNote,
      updateNote,
      setFontScale,
      setReaderTheme,
    }),
    [
      bookId,
      safeSlice.progress,
      safeSlice.bookmarks,
      safeSlice.highlights,
      safeSlice.notes,
      safeSlice.settings,
      setProgress,
      hydrateProgressFromCatalogIfEmpty,
      mergeAnnotationsFromServer,
      addBookmark,
      replaceBookmark,
      removeBookmark,
      addHighlight,
      replaceHighlight,
      removeHighlight,
      addNote,
      replaceNote,
      removeNote,
      updateNote,
      setFontScale,
      setReaderTheme,
    ]
  );
}
