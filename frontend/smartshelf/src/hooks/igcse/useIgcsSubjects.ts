import { useCallback, useEffect, useState } from 'react';

import { fetchIgcsSubjects } from '@/src/api/igcseCatalog';
import type { IgcseCatalogSubject } from '@/src/types/igcseCatalog';

export function useIgcsSubjects() {
  const [data, setData] = useState<IgcseCatalogSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchIgcsSubjects();
      setData(next);
    } catch (e) {
      setData([]);
      setError(e instanceof Error ? e.message : 'Could not load subjects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch, empty: !loading && !error && data.length === 0 };
}
