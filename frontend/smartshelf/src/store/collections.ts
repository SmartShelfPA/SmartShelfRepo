import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { universalStorage } from '@/src/lib/universalStorage';

export type Collection = {
  id: string;
  name: string;
  bookIds: string[];
};

type CollectionsState = {
  collections: Collection[];
  createCollection: (name: string) => Collection;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addBooksToCollection: (collectionId: string, bookIds: string[]) => void;
  removeBookFromCollection: (collectionId: string, bookId: string) => void;
};

export const useCollectionsStore = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],

      createCollection: (name) => {
        const collection: Collection = {
          id: `collection-${Date.now()}`,
          name: name.trim(),
          bookIds: [],
        };
        set((s) => ({ collections: [...s.collections, collection] }));
        return collection;
      },

      renameCollection: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === id ? { ...c, name: trimmed } : c
          ),
        }));
      },

      deleteCollection: (id) => {
        set((s) => ({ collections: s.collections.filter((c) => c.id !== id) }));
      },

      addBooksToCollection: (collectionId, bookIds) => {
        if (bookIds.length === 0) return;
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId
              ? { ...c, bookIds: Array.from(new Set([...c.bookIds, ...bookIds])) }
              : c
          ),
        }));
      },

      removeBookFromCollection: (collectionId, bookId) => {
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId
              ? { ...c, bookIds: c.bookIds.filter((id) => id !== bookId) }
              : c
          ),
        }));
      },
    }),
    {
      name: 'smartshelf-collections-store',
      storage: createJSONStorage(() => universalStorage),
      partialize: (state) => ({ collections: state.collections }),
    }
  )
);

export const getCollections = () => useCollectionsStore.getState().collections;
