import { useCallback, useState } from 'react';

import { searchIGCSE } from '@/src/api/igcseClient';
import type { IgcseSearchHit } from '@/src/types/igcseNormalized';

export type UseIgcsSearchState = {
  hits: IgcseSearchHit[];
  loading: boolean;
  error: string | null;
  lastQuery: string;
};

/**
 * Executes search on demand (call ``run(query, scopes?)`` — not auto-fired on keystroke).
 */
export function useIgcsSearch() {
  const [hits, setHits] = useState<IgcseSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  const run = useCallback(async (query: string, scopes?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const next = await searchIGCSE(query, scopes);
      setHits(next);
      setLastQuery(query.trim() || '*');
    } catch (e) {
      setHits([]);
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setHits([]);
    setError(null);
    setLastQuery('');
  }, []);

  return {
    hits,
    loading,
    error,
    lastQuery,
    search: run,
    clearResults,
    empty: !loading && !error && hits.length === 0,
  };
}
