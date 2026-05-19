import { useCallback, useEffect, useState } from 'react';

import { getIGCSEQuestions } from '@/src/api/igcseClient';
import type { IgcseQuestionsBundle } from '@/src/types/igcseNormalized';

export type UseIgcsTopicQuestionsOptions = {
  limitSelective?: number;
  limitTheory?: number;
  /** Increment to force a reload (e.g. session “Retry”). */
  reloadNonce?: number;
};

/** Loads normalized selective + theory for one topic (`GET /api/igcse/questions/`). */
export function useIgcsTopicQuestions(
  subjectSlug: string,
  topicSlug: string,
  opts?: UseIgcsTopicQuestionsOptions
) {
  const [bundle, setBundle] = useState<IgcseQuestionsBundle | null>(null);
  const [loading, setLoading] = useState(() =>
    Boolean(subjectSlug.trim() && topicSlug.trim())
  );
  const [error, setError] = useState<string | null>(null);

  const limitSelective = opts?.limitSelective;
  const limitTheory = opts?.limitTheory;
  const reloadNonce = opts?.reloadNonce ?? 0;

  const refetch = useCallback(async () => {
    if (!subjectSlug.trim() || !topicSlug.trim()) {
      setBundle(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getIGCSEQuestions(subjectSlug, topicSlug, {
        limitSelective,
        limitTheory,
      });
      setBundle(next);
    } catch (e) {
      setBundle(null);
      setError(e instanceof Error ? e.message : 'Could not load questions');
    } finally {
      setLoading(false);
    }
  }, [
    subjectSlug,
    topicSlug,
    limitSelective,
    limitTheory,
    reloadNonce,
  ]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const selective = bundle?.selective ?? [];
  const theory = bundle?.theory ?? [];
  const selectiveCount = selective.length;
  const theoryCount = theory.length;

  return {
    bundle,
    selective,
    theory,
    limits: bundle?.limits,
    loading,
    error,
    refetch,
    selectiveCount,
    theoryCount,
    empty: !loading && !error && selectiveCount === 0 && theoryCount === 0,
  };
}
