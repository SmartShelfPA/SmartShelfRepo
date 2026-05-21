import { getBackendBaseUrl } from '@/services/api';

/** Turn relative Django media paths into absolute URLs for the mobile app. */
export function resolveMediaUrl(url: string | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = getBackendBaseUrl().replace(/\/+$/, '');
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}
