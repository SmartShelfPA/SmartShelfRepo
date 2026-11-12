import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchReadingState, saveReadingState } from '@/src/api/study';
import { useBookLastPage } from '@/src/hooks/useBookLastPage';

const AT_PREFIX = 'igcse_last_page_at_v1_';

export type SyncState = 'unknown' | 'synced' | 'local';

/** Local page plus the server copy, so phone and desktop open the later position. */
export function useSyncedReadingPage(bookId: string) {
  const { getLastPage: getLocalPage, saveLastPage: saveLocalPage } = useBookLastPage(bookId);
  const [syncState, setSyncState] = useState<SyncState>('unknown');

  const getLastPage = useCallback(async (): Promise<number> => {
    const localPage = await getLocalPage();
    if (!bookId) return localPage;
    let localAt = '';
    try {
      localAt = (await AsyncStorage.getItem(`${AT_PREFIX}${bookId}`)) ?? '';
    } catch {
      localAt = '';
    }
    try {
      const remote = await fetchReadingState(bookId);
      const remoteAt = remote.updated_at ?? '';
      if (remote.page > 1 && remoteAt && remoteAt > localAt) {
        await saveLocalPage(remote.page);
        setSyncState('synced');
        return remote.page;
      }
      setSyncState(remote.updated_at ? 'synced' : 'local');
    } catch {
      setSyncState('local');
    }
    return localPage;
  }, [bookId, getLocalPage, saveLocalPage]);

  const saveLastPage = useCallback(
    async (page: number): Promise<void> => {
      await saveLocalPage(page);
      if (!bookId) return;
      const stamp = new Date().toISOString();
      try {
        await AsyncStorage.setItem(`${AT_PREFIX}${bookId}`, stamp);
      } catch {
        /* local page is already stored */
      }
      try {
        await saveReadingState(bookId, page);
        setSyncState('synced');
      } catch {
        setSyncState('local');
      }
    },
    [bookId, saveLocalPage]
  );

  return { getLastPage, saveLastPage, syncState };
}
