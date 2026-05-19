import { useCallback, useEffect, useState } from 'react';

import {
  fetchIgcsSetDetail,
  fetchIgcsSetsForChapter,
  pickPrimarySet,
} from '@/src/api/igcseCatalog';
import type { IgcseGeneratedSetDetail } from '@/src/types/igcseCatalog';

export function useIgcsChapterSet(subjectSlug: string, chapterSlug: string) {
  const [data, setData] = useState<IgcseGeneratedSetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const subject = subjectSlug.trim().toLowerCase();
    const chapter = chapterSlug.trim().toLowerCase();
    if (!subject || !chapter) {
      setData(null);
      setLoading(false);
      setError('Missing subject or chapter');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const summaries = await fetchIgcsSetsForChapter(subject, chapter);
      const primary = pickPrimarySet(summaries);
      if (!primary) {
        setData(null);
        return;
      }
      const detail = await fetchIgcsSetDetail(primary.id);
      setData(detail);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load chapter resources');
    } finally {
      setLoading(false);
    }
  }, [subjectSlug, chapterSlug]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    data,
    loading,
    error,
    refetch,
    empty: !loading && !error && data === null,
  };
}
