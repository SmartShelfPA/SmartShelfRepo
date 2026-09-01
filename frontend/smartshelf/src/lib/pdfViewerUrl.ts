import { getBackendBaseUrl } from '@/services/api';

/** Resolve a PDF location the viewer can fetch (proxy remote URLs; keep blob/data). */
export function resolvePdfFetchUrl(pdfUrl: string): string {
  const trimmed = pdfUrl.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('blob:') || lower.startsWith('data:')) {
    return trimmed;
  }
  const base = getBackendBaseUrl();
  return `${base}/api/pdf-proxy/?url=${encodeURIComponent(trimmed)}`;
}

function sameOriginViewerBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/pdf-viewer.html`;
  }
  return '/pdf-viewer.html';
}

/**
 * Same-origin PDF.js page for web/Electron.
 * External mozilla.github.io cannot load blob: URLs from localhost/Electron.
 */
export function buildPdfViewerSrc(pdfUrl: string, page = 1): string {
  const resolved = resolvePdfFetchUrl(pdfUrl);
  if (!resolved) return '';
  const params = new URLSearchParams();
  params.set('file', resolved);
  if (page > 1) params.set('page', String(page));
  return `${sameOriginViewerBase()}?${params.toString()}`;
}
