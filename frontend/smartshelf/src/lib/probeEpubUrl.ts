import { getApiExtraHeaders } from '@/services/api';

/**
 * Lightweight reachability check for remote EPUB assets before opening in WebView.
 * Uses HEAD (or ranged GET) so we do not download the full archive.
 *
 * Returns `'ok'` on success or `'soft-fail'` when the server rejects the probe
 * with 401/403 but the WebView (which has a real browser UA) might still succeed.
 * Only throws for hard failures (empty URL, 404, network error, timeout).
 */
const DEFAULT_TIMEOUT_MS = 20000;

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function extraHeadersForUrl(url: string, injected: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    Accept: 'application/epub+zip,application/octet-stream,*/*',
    ...injected,
  };
  if (/ngrok/i.test(url)) {
    Object.assign(headers, getApiExtraHeaders());
  }
  return headers;
}

export type ProbeResult = 'ok' | 'soft-fail';

export async function probeEpubUrl(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  extraHeaders: Record<string, string> = {}
): Promise<ProbeResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('EPUB URL is empty.');
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('EPUB URL must start with http:// or https://');
  }
  if (/\.html?(?:\?|#|$)/i.test(trimmed)) {
    throw new Error(
      'EPUB URL points to an HTML page, not an .epub file. In Django admin use a direct .epub download link.'
    );
  }
  if (/gutenberg\.org\/ebooks\//i.test(trimmed) && !/gutenberg\.org\/cache\/epub\//i.test(trimmed)) {
    throw new Error(
      'Gutenberg landing URLs are not direct EPUB files. Use https://www.gutenberg.org/cache/epub/<id>/pg<id>-images-3.epub'
    );
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    let response = await fetch(trimmed, {
      method: 'HEAD',
      headers: extraHeadersForUrl(trimmed, extraHeaders),
      signal: ctrl.signal,
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(trimmed, {
        method: 'GET',
        headers: { ...extraHeadersForUrl(trimmed, extraHeaders), Range: 'bytes=0-1023' },
        signal: ctrl.signal,
      });
    }

    if (response.status === 401 || response.status === 403) {
      return 'soft-fail';
    }
    if (response.status === 404) {
      throw new Error('EPUB URL returned HTTP 404 — file not found on server');
    }
    if (response.status >= 400) {
      throw new Error(`EPUB URL returned HTTP ${response.status}`);
    }

    return 'ok';
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`EPUB URL timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    if (e instanceof Error) {
      throw e;
    }
    throw new Error('EPUB URL check failed');
  } finally {
    clearTimeout(timer);
  }
}
