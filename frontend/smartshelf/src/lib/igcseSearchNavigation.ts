import type { Href } from 'expo-router';

import type { IgcseSearchHit } from '@/src/types/igcseNormalized';

const COURSE_PATH = /^\/courses\/([a-z0-9_]+)(?:\/([a-z0-9_]+))?\/?$/i;

/** Parse `/courses/{subject}/{topic?}` segments from upstream Open IGCSE paths. */
export function parseIgcsCoursePath(path: string | undefined): {
  subject: string | null;
  topic: string | null;
} {
  if (!path || typeof path !== 'string') return { subject: null, topic: null };
  const m = path.trim().match(COURSE_PATH);
  if (!m) return { subject: null, topic: null };
  return { subject: m[1]?.toLowerCase() ?? null, topic: m[2]?.toLowerCase() ?? null };
}

/** Best-effort Expo Router targets for MCQ practice / topic browsing from search hits. */
export function igcseHitToHref(hit: IgcseSearchHit): Href | null {
  const { subject, topic } = parseIgcsCoursePath(hit.path);

  if (hit.is_topic) {
    const subj = subject;
    const slugNorm = hit.slug.trim().toLowerCase().replace(/-/g, '_');
    const topicSlug = topic ?? slugNorm;
    if (subj && topicSlug) {
      return {
        pathname: '/igcse/revision/session',
        params: { subject: subj, topic: topicSlug },
      } as unknown as Href;
    }
    return null;
  }

  const subj = subject ?? hit.slug.trim().toLowerCase();
  if (!subj) return null;
  return {
    pathname: '/igcse/revision/[subject]',
    params: { subject: subj },
  } as unknown as Href;
}
