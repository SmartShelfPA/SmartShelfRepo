import { useCallback, useEffect, useState } from 'react';

import { listProtectedPdfs, type ProtectedPdfAsset } from '@/src/api/protectedPdfs';

export function useProtectedPdfs() {
  const [data, setData] = useState<ProtectedPdfAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await listProtectedPdfs();
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load resources');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    assets: data,
    isLoading,
    error,
    refetch,
    empty: !isLoading && !error && data.length === 0,
  };
}
