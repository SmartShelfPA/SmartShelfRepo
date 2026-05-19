import type { Href } from 'expo-router';
import type { Router } from 'expo-router';

import { getBackendBaseUrl } from '@/services/api';

/** Open PDF in the in-app viewer (proxies external URLs via Django). */
export function openIgcsPdf(router: Router, pdfUrl: string, title?: string): void {
  if (!pdfUrl.trim()) return;
  router.push({
    pathname: '/pdf-viewer',
    params: {
      uri: pdfUrl.trim(),
      ...(title ? { title } : {}),
    },
  } as Href);
}

export function openIgcsSimulator(
  router: Router,
  params: { url: string; title?: string; setId?: string }
): void {
  if (!params.url.trim()) return;
  router.push({
    pathname: '/igcse/simulator',
    params: {
      url: params.url.trim(),
      title: params.title ?? 'Exam simulator',
      ...(params.setId ? { setId: params.setId } : {}),
    },
  } as Href);
}

/** Resolve relative media paths from Django when needed. */
export function resolveMediaUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = getBackendBaseUrl().replace(/\/+$/, '');
  return u.startsWith('/') ? `${base}${u}` : `${base}/${u}`;
}
