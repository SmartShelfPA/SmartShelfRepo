import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchDashboard } from '@/src/api/dashboard';
import { usePracticeHistoryStore } from '@/src/store/practiceHistoryStore';
import type { DashboardData } from '@/src/types/dashboard';
import type { PracticeSessionSummary } from '@/src/types/practice';

function mergeSessions(
  remote: PracticeSessionSummary[],
  local: PracticeSessionSummary[]
): PracticeSessionSummary[] {
  const map = new Map<string, PracticeSessionSummary>();
  [...remote, ...local].forEach((s) => {
    map.set(s.id, s);
  });
  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.startedAt).getTime();
    const tb = new Date(b.startedAt).getTime();
    return tb - ta;
  });
}

export function useDashboardData() {
  const [remote, setRemote] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const localSessions = usePracticeHistoryStore((s) => s.sessions);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const d = await fetchDashboard();
      setRemote(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const data = useMemo<DashboardData | null>(() => {
    if (!remote) return null;
    const mergedSessions = mergeSessions(remote.recentSessions ?? [], localSessions);
    return {
      ...remote,
      recentSessions: mergedSessions.slice(0, 12),
    };
  }, [remote, localSessions]);

  return { data, isLoading, error, refetch };
}
