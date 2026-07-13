import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'igcse_last_page_v1_';

export function useBookLastPage(bookId: string) {
  const getLastPage = useCallback(async (): Promise<number> => {
    if (!bookId) return 1;
    try {
      const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${bookId}`);
      const page = raw ? parseInt(raw, 10) : 1;
      return isNaN(page) || page < 1 ? 1 : page;
    } catch {
      return 1;
    }
  }, [bookId]);

  const saveLastPage = useCallback(
    async (page: number): Promise<void> => {
      if (!bookId || page < 1) return;
      try {
        await AsyncStorage.setItem(`${KEY_PREFIX}${bookId}`, String(page));
      } catch {}
    },
    [bookId]
  );

  return { getLastPage, saveLastPage };
}
