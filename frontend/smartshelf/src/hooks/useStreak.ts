/**
 * useStreak
 *
 * Computes the user's current study streak: the number of consecutive
 * calendar days (in local time) ending with today or yesterday that
 * contained at least one completed practice session.
 *
 * Sources merged (deduped by session id):
 *  - Local persisted sessions from `usePracticeHistoryStore`
 *  - Remote sessions passed in (from the dashboard API response)
 */

import { useMemo } from 'react';

import { usePracticeHistoryStore } from '@/src/store/practiceHistoryStore';
import type { PracticeSessionSummary } from '@/src/types/practice';

/** Returns a YYYY-MM-DD string in the device's local timezone. */
function toLocalDateStr(isoString: string): string {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns today's YYYY-MM-DD in local time. */
function todayStr(): string {
  return toLocalDateStr(new Date().toISOString());
}

/** Subtracts `n` days from a YYYY-MM-DD string and returns the result. */
function subtractDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - n);
  return toLocalDateStr(d.toISOString());
}

export function useStreak(remoteSessions: PracticeSessionSummary[] = []): number {
  const localSessions = usePracticeHistoryStore((s) => s.sessions);

  return useMemo(() => {
    // Merge and deduplicate sessions by id.
    const map = new Map<string, PracticeSessionSummary>();
    [...localSessions, ...remoteSessions].forEach((s) => map.set(s.id, s));
    const all = Array.from(map.values());

    if (all.length === 0) return 0;

    // Collect the unique calendar days that had at least one session.
    const activeDays = new Set<string>();
    for (const session of all) {
      const raw = session.startedAt;
      if (typeof raw === 'string' && raw.length > 0) {
        activeDays.add(toLocalDateStr(raw));
      }
    }

    if (activeDays.size === 0) return 0;

    // Walk backwards from today. If today has no activity, check yesterday —
    // a streak is still live if the user hasn't opened the app yet today.
    const today = todayStr();
    const yesterday = subtractDays(today, 1);

    // Find the starting anchor: today if active, yesterday if active, else 0.
    let cursor: string;
    if (activeDays.has(today)) {
      cursor = today;
    } else if (activeDays.has(yesterday)) {
      cursor = yesterday;
    } else {
      return 0;
    }

    // Count consecutive active days going backward from the anchor.
    let streak = 0;
    while (activeDays.has(cursor)) {
      streak++;
      cursor = subtractDays(cursor, 1);
    }

    return streak;
  }, [localSessions, remoteSessions]);
}
