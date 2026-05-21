import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { universalStorage } from '@/src/lib/universalStorage';

import {
  Book as ApiBook,
  BookshelfItem,
  fetchBookshelf,
} from '@/services/api';

export type Book = {
  id: string;
  title: string;
  subject: string;
  examTags: ('IGCSE' | 'WAEC')[] | string[];
  coverUri?: string;
  pdfUri?: string;
  author?: string;
  lastAccessedAt?: string;
  progressPercent?: number;
};

type BooksState = {
  books: Book[];
  bookshelf: BookshelfItem[];
  isLoading: boolean;
  loadBooks: (params?: { search?: string; category?: string }) => Promise<void>;
  loadBookshelf: () => Promise<void>;
  addBook: (book: Book) => void;
  setBooks: (nextBooks: Book[]) => void;
};

const mapApiBookToLegacy = (book: ApiBook): Book => ({
  id: book.id,
  title: book.title,
  subject: book.category?.[0] ?? 'General',
  examTags: book.category ?? [],
  coverUri: book.coverImageUrl,
  author: book.author,
});

export const useBooksStore = create<BooksState>()(
  persist(
    (set) => ({
      books: [],
      bookshelf: [],
      isLoading: false,

      loadBooks: async (params) => {
        set({ isLoading: true });
        try {
          const query = params?.search?.trim().toLowerCase();
          const category = params?.category?.trim();
          set((state) => {
            const filtered = state.books.filter((book) => {
              const categoryMatch = category ? book.subject === category : true;
              const queryMatch = query
                ? book.title.toLowerCase().includes(query) ||
                  book.subject.toLowerCase().includes(query) ||
                  book.examTags.some((tag) => tag.toLowerCase().includes(query))
                : true;
              return categoryMatch && queryMatch;
            });
            return { books: filtered };
          });
        } finally {
          set({ isLoading: false });
        }
      },

      loadBookshelf: async () => {
        set({ isLoading: true });
        try {
          const data = await fetchBookshelf();
          const mapped = data.map((item) => ({
            ...mapApiBookToLegacy(item.book),
            progressPercent: item.progress.percent_complete,
          }));
          set({ bookshelf: data, books: mapped });
        } finally {
          set({ isLoading: false });
        }
      },

      addBook: (book) => set((state) => ({ books: [book, ...state.books] })),
      setBooks: (nextBooks) => set({ books: nextBooks }),
    }),
    {
      name: 'smartshelf-books-store',
      storage: createJSONStorage(() => universalStorage),
      partialize: (state) => ({
        books: state.books,
      }),
    }
  )
);

// Compatibility helpers for existing screens.
export const getBooks = () => useBooksStore.getState().books;
export const addBook = (book: Book) => useBooksStore.getState().addBook(book);
export const getBookById = (id: string) =>
  useBooksStore.getState().books.find((book) => book.id === id);
export const setBooks = (nextBooks: Book[]) => useBooksStore.getState().setBooks(nextBooks);
