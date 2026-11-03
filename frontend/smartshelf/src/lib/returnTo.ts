import type { Href } from 'expo-router';

import { isAuthPath } from '@/src/lib/desktop';

const STORAGE_KEY = 'smartshelf:returnTo';

let pending: string | null = null;
let latched: Href | null = null;
let latchedAt = 0;

function sanitize(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) return null;
  const pathname = trimmed.split(/[?#]/)[0] || trimmed;
  if (pathname === '/' || isAuthPath(pathname)) return null;
  return trimmed;
}

function readStored(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sanitize(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStored(path: string | null) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (path) sessionStorage.setItem(STORAGE_KEY, path);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode can block storage. The in-memory value still works.
  }
}

/** Remember the screen a signed-out visitor was trying to open. */
export function rememberReturnTo(fallbackPath?: string | null) {
  const live =
    typeof window !== 'undefined' && window.location
      ? `${window.location.pathname}${window.location.search}`
      : (fallbackPath ?? '');
  const safe = sanitize(live) ?? sanitize(fallbackPath);
  if (!safe) return;
  pending = safe;
  latched = null;
  writeStored(safe);
}

export function clearReturnTo() {
  pending = null;
  latched = null;
  latchedAt = 0;
  writeStored(null);
}

/**
 * Path to open after a successful sign-in.
 * Repeated calls in the same moment return the same path, so the login
 * screen and its "already signed in" effect cannot send the person home.
 */
export function resolvePostAuthHref(fallback: Href): Href {
  const now = Date.now();
  if (latched && now - latchedAt < 1500) return latched;
  const target = sanitize(pending) ?? readStored();
  pending = null;
  writeStored(null);
  const href = (target ?? fallback) as Href;
  latched = href;
  latchedAt = now;
  return href;
}
