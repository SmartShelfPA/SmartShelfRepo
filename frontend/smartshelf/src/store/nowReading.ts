import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Href, Router } from 'expo-router';

import { prepareProtectedOpen } from '@/src/lib/protectedPdfAccess';
import { universalStorage } from '@/src/lib/universalStorage';

export type NowReadingKind = 'pdf' | 'epub' | 'route';

export type NowReadingSession = {
  kind: NowReadingKind;
  bookId: string;
  title: string;
  subtitle?: string;
  progressPercent: number;
  assetId?: string;
  href?: string;
  coverUri?: string;
  updatedAt: string;
};

type NowReadingState = {
  current: NowReadingSession | null;
  recent: NowReadingSession[];
  setSession: (session: Omit<NowReadingSession, 'updatedAt'> & { updatedAt?: string }) => void;
  updateProgress: (bookId: string, progressPercent: number, subtitle?: string) => void;
  clear: () => void;
};

const MAX_RECENT = 12;

function upsertRecent(list: NowReadingSession[], session: NowReadingSession): NowReadingSession[] {
  const next = [session, ...list.filter((item) => item.bookId !== session.bookId)];
  return next.slice(0, MAX_RECENT);
}

export const useNowReadingStore = create<NowReadingState>()(
  persist(
    (set, get) => ({
      current: null,
      recent: [],

      setSession: (session) => {
        const next: NowReadingSession = {
          ...session,
          progressPercent: Math.min(100, Math.max(0, session.progressPercent || 0)),
          updatedAt: session.updatedAt ?? new Date().toISOString(),
        };
        set({
          current: next,
          recent: upsertRecent(get().recent, next),
        });
      },

      updateProgress: (bookId, progressPercent, subtitle) => {
        const current = get().current;
        if (!current || current.bookId !== bookId) return;
        const next = {
          ...current,
          progressPercent: Math.min(100, Math.max(0, progressPercent)),
          subtitle: subtitle ?? current.subtitle,
          updatedAt: new Date().toISOString(),
        };
        set({
          current: next,
          recent: upsertRecent(get().recent, next),
        });
      },

      clear: () => set({ current: null }),
    }),
    {
      name: 'smartshelf-now-reading',
      storage: createJSONStorage(() => universalStorage),
      partialize: (s) => ({ current: s.current, recent: s.recent }),
    }
  )
);

export async function resumeNowReading(router: Router): Promise<boolean> {
  const current = useNowReadingStore.getState().current;
  if (!current) return false;

  if (current.kind === 'pdf' && current.assetId) {
    const result = await prepareProtectedOpen(current.assetId);
    if (result.ok) {
      router.push({
        pathname: '/igcse/pdf-reader',
        params: {
          localUri: result.localUri,
          bookId: current.assetId,
          title: current.title,
        },
      } as unknown as Href);
      return true;
    }
    router.push('/downloads' as Href);
    return false;
  }

  if (current.kind === 'epub') {
    router.push(`/igcse/reader/${current.bookId}` as Href);
    return true;
  }

  if (current.href) {
    router.push(current.href as Href);
    return true;
  }

  return false;
}
