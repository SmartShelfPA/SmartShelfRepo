import { useCallback, useEffect, useState } from 'react';

import { fetchIgcsChapters } from '@/src/api/igcseCatalog';
import type { IgcseCatalogChapter } from '@/src/types/igcseCatalog';

export function useIgcsChapters(subjectSlug: string) {
  const [data, setData] = useState<IgcseCatalogChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const slug = subjectSlug.trim().toLowerCase();
    if (!slug) {
      setData([]);
      setLoading(false);
      setError('Missing subject');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchIgcsChapters(slug));
    } catch (e) {
      setData([]);
      setError(e instanceof Error ? e.message : 'Could not load chapters');
    } finally {
      setLoading(false);
    }
  }, [subjectSlug]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch, empty: !loading && !error && data.length === 0 };
}
