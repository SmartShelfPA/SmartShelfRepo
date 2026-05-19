import { useCallback, useEffect, useState } from 'react';

import { getIGCSETopics } from '@/src/api/igcseClient';
import type { IgcseRevisionTopic } from '@/src/types/igcseNormalized';

export function useIgcsTopics(subjectSlug: string) {
  const [data, setData] = useState<IgcseRevisionTopic[]>([]);
  const [loading, setLoading] = useState(() => Boolean(subjectSlug.trim()));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!subjectSlug.trim()) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getIGCSETopics(subjectSlug);
      setData(next);
    } catch (e) {
      setData([]);
      setError(e instanceof Error ? e.message : 'Could not load topics');
    } finally {
      setLoading(false);
    }
  }, [subjectSlug]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch, empty: !loading && !error && data.length === 0 };
}
