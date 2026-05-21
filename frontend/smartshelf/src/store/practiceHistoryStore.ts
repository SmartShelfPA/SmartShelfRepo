import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { universalStorage } from '@/src/lib/universalStorage';
import type { PracticeSessionSummary } from '@/src/types/practice';

type PracticeHistoryState = {
  sessions: PracticeSessionSummary[];
  addSession: (session: PracticeSessionSummary) => void;
};

export const usePracticeHistoryStore = create<PracticeHistoryState>()(
  persist(
    (set) => ({
      sessions: [],

      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, 50),
        })),
    }),
    {
      name: 'smartshelf-practice-history',
      storage: createJSONStorage(() => universalStorage),
      partialize: (s) => ({ sessions: s.sessions }),
    }
  )
);
