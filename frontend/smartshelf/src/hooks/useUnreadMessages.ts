import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchUnreadMessageCount } from '@/src/api/messages';

const REFRESH_MS = 60000;

/** Unread parent–teacher messages, refreshed when the screen is focused and every minute. */
export function useUnreadMessages(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let active = true;
      const refresh = () =>
        fetchUnreadMessageCount()
          .then((n) => active && setCount(n))
          .catch(() => {});
      void refresh();
      const timer = setInterval(refresh, REFRESH_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [enabled])
  );

  return count;
}
