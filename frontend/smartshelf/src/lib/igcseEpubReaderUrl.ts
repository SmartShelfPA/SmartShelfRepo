import { API_BASE_URL, getToken } from '@/services/api';
import { isBundledIgcsBookId } from '@/src/data/bundledIgcsTextbooks';
import { isBackendIgcsBookId } from '@/src/services/igcseEpubService';

/** Authenticated EPUB stream URL for Django-backed textbooks (WebView reader).
 *  Appends token as query param so the WebView doesn't need Authorization headers
 *  (which trigger CORS preflights that get blocked on mixed HTTP/HTTPS origins). */
export function buildIgcsEpubStreamUrl(bookId: string, token?: string | null): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const url = `${base}/v1/igcse/books/${bookId.trim()}/epub/`;
  if (token) return `${url}?token=${encodeURIComponent(token)}`;
  return url;
}

/** Repo-bundled EPUB stream (``bundled-igcse/`` on the server). No auth needed. */
export function buildBundledIgcsEpubStreamUrl(bookId: string): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  return `${base}/v1/igcse/bundled/${encodeURIComponent(bookId.trim())}/epub/`;
}

/** Resolve the URL epub.js should fetch inside the WebView. */
export async function resolveIgcsReaderEpubUrl(bookId: string, catalogEpubUrl: string): Promise<string> {
  const id = bookId.trim();
  if (isBundledIgcsBookId(id)) {
    return buildBundledIgcsEpubStreamUrl(id);
  }
  if (id && isBackendIgcsBookId(id)) {
    const token = await getToken();
    return buildIgcsEpubStreamUrl(id, token);
  }
  return catalogEpubUrl.trim();
}
