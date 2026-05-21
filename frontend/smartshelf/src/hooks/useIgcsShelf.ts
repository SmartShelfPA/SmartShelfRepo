import { useCallback, useEffect, useState } from 'react';

import { getIGCSEBooks } from '@/src/services/igcseEpubService';
import type { IgcsTextbook } from '@/src/types/igcse';

export function useIgcsShelf() {
  const [data, setData] = useState<IgcsTextbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await getIGCSEBooks();
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load textbooks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    books: data,
    isLoading,
    error,
    refetch,
    empty: !isLoading && !error && data.length === 0,
  };
}
