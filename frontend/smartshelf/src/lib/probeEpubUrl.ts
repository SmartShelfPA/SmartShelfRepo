import { getApiExtraHeaders } from '@/services/api';

/**
 * Lightweight reachability check for remote EPUB assets before opening in WebView.
 * Uses a small ranged GET so we do not download the full archive.
 */
const DEFAULT_TIMEOUT_MS = 20000;

function extraHeadersForUrl(url: string): Record<string, string> {
  const headers: Record<string, string> = {
    Range: 'bytes=0-4095',
    Accept: 'application/epub+zip,application/octet-stream,*/*',
  };
  if (/ngrok/i.test(url)) {
    Object.assign(headers, getApiExtraHeaders());
  }
  return headers;
}

export async function probeEpubUrl(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('EPUB URL is empty.');
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('EPUB URL must start with http:// or https://');
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  const fail = (status: number, hint?: string) => {
    const tail = hint ? ` — ${hint}` : '';
    throw new Error(`EPUB URL returned HTTP ${status}${tail}`);
  };

  try {
    let response = await fetch(trimmed, {
      method: 'GET',
      headers: extraHeadersForUrl(trimmed),
      signal: ctrl.signal,
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(trimmed, {
        method: 'HEAD',
        headers: extraHeadersForUrl(trimmed),
        signal: ctrl.signal,
      });
    }

    if (response.status === 401 || response.status === 403) {
      fail(response.status, 'check login or media permissions on the server');
    }
    if (response.status === 404) {
      fail(response.status, 'file not found on server');
    }
    if (response.status >= 400) {
      fail(response.status);
    }
    if (!response.ok && response.status !== 206) {
      fail(response.status);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (
      contentType &&
      !/epub|zip|octet-stream|application\/x-/i.test(contentType) &&
      !contentType.includes('html')
    ) {
      // Allow unknown types; block obvious wrong payloads (e.g. JSON error pages).
      if (/json|text\/plain/i.test(contentType)) {
        fail(response.status, `unexpected content-type: ${contentType}`);
      }
    }
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
