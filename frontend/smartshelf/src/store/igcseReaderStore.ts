import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { syncIgcsReaderProgress } from '@/src/api/igcseBooks';
import { universalStorage } from '@/src/lib/universalStorage';
import type {
  EpubBookmark,
  EpubHighlight,
  EpubNote,
  EpubReadingProgress,
} from '@/src/types/igcse';

export type ReaderVisualSettings = {
  fontScale: number;
  readerTheme: 'light' | 'dark';
};

type BookReaderSlice = {
  progress: EpubReadingProgress | null;
  bookmarks: EpubBookmark[];
  highlights: EpubHighlight[];
  notes: EpubNote[];
  settings: ReaderVisualSettings;
};

const defaultSlice = (): BookReaderSlice => ({
  progress: null,
  bookmarks: [],
  highlights: [],
  notes: [],
  settings: { fontScale: 1, readerTheme: 'light' },
});

const SERVER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isServerEntityId(id: string): boolean {
  return SERVER_UUID_RE.test(id.trim());
}

function cfiKey(loc: { startCfi?: string } | undefined): string | undefined {
  const c = loc?.startCfi?.trim();
  return c && c.length > 0 ? c : undefined;
}

function mergePendingByCfi<T extends { location: { startCfi?: string }; id: string }>(
  server: T[],
  pending: T[]
): T[] {
  const serverCfis = new Set(
    server.map((s) => cfiKey(s.location)).filter((k): k is string => Boolean(k))
  );
  const extra = pending.filter((p) => {
    if (isServerEntityId(p.id)) return false;
    const k = cfiKey(p.location);
    return k ? !serverCfis.has(k) : true;
  });
  return [...server, ...extra];
}

export type NewEpubBookmarkPayload = Omit<EpubBookmark, 'id' | 'createdAt'> &
  Partial<Pick<EpubBookmark, 'id' | 'createdAt'>>;
export type NewEpubHighlightPayload = Omit<EpubHighlight, 'id' | 'createdAt'> &
  Partial<Pick<EpubHighlight, 'id' | 'createdAt'>>;
export type NewEpubNotePayload = Omit<EpubNote, 'id' | 'createdAt'> &
  Partial<Pick<EpubNote, 'id' | 'createdAt'>>;

type IgcsReaderState = {
  books: Record<string, BookReaderSlice>;
  ensureBook: (bookId: string) => void;
  /** Local + `PUT …/progress/` (best-effort). */
  setProgress: (bookId: string, progress: EpubReadingProgress) => void;
  /** Seed fraction from catalog when the user has no local progress yet (no network call). */
  hydrateProgressFromCatalogIfEmpty: (
    bookId: string,
    catalog: { progressPercent?: number; lastReadAt?: string }
  ) => void;
  mergeAnnotationsFromServer: (
    bookId: string,
    server: { bookmarks: EpubBookmark[]; highlights: EpubHighlight[]; notes: EpubNote[] }
  ) => void;
  addBookmark: (bookId: string, bookmark: NewEpubBookmarkPayload) => string;
  replaceBookmark: (bookId: string, oldId: string, bookmark: EpubBookmark) => void;
  removeBookmark: (bookId: string, bookmarkId: string) => void;
  addHighlight: (bookId: string, highlight: NewEpubHighlightPayload) => string;
  replaceHighlight: (bookId: string, oldId: string, highlight: EpubHighlight) => void;
  removeHighlight: (bookId: string, highlightId: string) => void;
  addNote: (bookId: string, note: NewEpubNotePayload) => string;
  replaceNote: (bookId: string, oldId: string, note: EpubNote) => void;
  updateNote: (bookId: string, noteId: string, body: string) => void;
  removeNote: (bookId: string, noteId: string) => void;
  setFontScale: (bookId: string, fontScale: number) => void;
  setReaderTheme: (bookId: string, readerTheme: ReaderVisualSettings['readerTheme']) => void;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useIgcsReaderStore = create<IgcsReaderState>()(
  persist(
    (set, get) => ({
      books: {},

      ensureBook: (bookId) =>
        set((state) => {
          if (state.books[bookId]) return state;
          return { books: { ...state.books, [bookId]: defaultSlice() } };
        }),

      hydrateProgressFromCatalogIfEmpty: (bookId, catalog) => {
        get().ensureBook(bookId);
        const cur = get().books[bookId]?.progress;
        if (cur != null) return;
        if (catalog.progressPercent == null && !catalog.lastReadAt?.trim()) return;
        const fraction =
          catalog.progressPercent != null
            ? Math.min(1, Math.max(0, catalog.progressPercent / 100))
            : 0;
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              progress: {
                bookId,
                fraction,
                updatedAt: catalog.lastReadAt ?? new Date().toISOString(),
              },
            },
          },
        }));
      },

      mergeAnnotationsFromServer: (bookId, server) => {
        get().ensureBook(bookId);
        set((state) => {
          const local = state.books[bookId] ?? defaultSlice();
          return {
            books: {
              ...state.books,
              [bookId]: {
                ...local,
                bookmarks: mergePendingByCfi(server.bookmarks, local.bookmarks),
                highlights: mergePendingByCfi(server.highlights, local.highlights),
                notes: mergePendingByCfi(server.notes, local.notes),
              },
            },
          };
        });
      },

      setProgress: (bookId, progress) => {
        get().ensureBook(bookId);
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              progress,
            },
          },
        }));
        void syncIgcsReaderProgress({
          book_id: bookId,
          fraction: progress.fraction,
          start_cfi: progress.startCfi,
          updated_at: progress.updatedAt,
        });
      },

      addBookmark: (bookId, payload) => {
        get().ensureBook(bookId);
        const id = payload.id ?? uid('bm');
        const createdAt = payload.createdAt ?? new Date().toISOString();
        const bookmark: EpubBookmark = { ...payload, id, createdAt };
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              bookmarks: [...state.books[bookId].bookmarks, bookmark],
            },
          },
        }));
        return id;
      },

      replaceBookmark: (bookId, oldId, bookmark) =>
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              bookmarks: state.books[bookId].bookmarks.map((b) => (b.id === oldId ? bookmark : b)),
            },
          },
        })),

      removeBookmark: (bookId, bookmarkId) =>
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              bookmarks: state.books[bookId].bookmarks.filter((b) => b.id !== bookmarkId),
            },
          },
        })),

      addHighlight: (bookId, payload) => {
        get().ensureBook(bookId);
        const id = payload.id ?? uid('hl');
        const createdAt = payload.createdAt ?? new Date().toISOString();
        const highlight: EpubHighlight = { ...payload, id, createdAt };
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              highlights: [...state.books[bookId].highlights, highlight],
            },
          },
        }));
        return id;
      },

      replaceHighlight: (bookId, oldId, highlight) =>
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              highlights: state.books[bookId].highlights.map((h) => (h.id === oldId ? highlight : h)),
            },
          },
        })),

      removeHighlight: (bookId, highlightId) =>
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              highlights: state.books[bookId].highlights.filter((h) => h.id !== highlightId),
            },
          },
        })),

      addNote: (bookId, payload) => {
        get().ensureBook(bookId);
        const id = payload.id ?? uid('nt');
        const createdAt = payload.createdAt ?? new Date().toISOString();
        const note: EpubNote = { ...payload, id, createdAt };
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              notes: [...state.books[bookId].notes, note],
            },
          },
        }));
        return id;
      },

      replaceNote: (bookId, oldId, note) =>
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              notes: state.books[bookId].notes.map((n) => (n.id === oldId ? note : n)),
            },
          },
        })),

      updateNote: (bookId, noteId, body) =>
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              notes: state.books[bookId].notes.map((n) =>
                n.id === noteId ? { ...n, body } : n
              ),
            },
          },
        })),

      removeNote: (bookId, noteId) =>
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              notes: state.books[bookId].notes.filter((n) => n.id !== noteId),
            },
          },
        })),

      setFontScale: (bookId, fontScale) => {
        get().ensureBook(bookId);
        const clamped = Math.min(1.6, Math.max(0.85, fontScale));
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              settings: { ...state.books[bookId].settings, fontScale: clamped },
            },
          },
        }));
      },

      setReaderTheme: (bookId, readerTheme) => {
        get().ensureBook(bookId);
        set((state) => ({
          books: {
            ...state.books,
            [bookId]: {
              ...state.books[bookId],
              settings: { ...state.books[bookId].settings, readerTheme },
            },
          },
        }));
      },
    }),
    {
      name: 'smartshelf-igcse-reader',
      storage: createJSONStorage(() => universalStorage),
      partialize: (s) => ({ books: s.books }),
    }
  )
);

export function selectBookSlice(bookId: string) {
  return (s: IgcsReaderState): BookReaderSlice => s.books[bookId] ?? defaultSlice();
}
