import { Platform, useWindowDimensions } from 'react-native';

import type { SmartShelfDesktopBridge } from '@/src/types/desktop';

const DESKTOP_LAYOUT_MIN_WIDTH = 960;

/** True only inside the packaged/dev Electron shell. */
export function isElectronDesktop(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as Window & { smartshelfDesktop?: SmartShelfDesktopBridge }).smartshelfDesktop
      ?.isDesktop === true
  );
}

/**
 * SoundCloud-style chrome: Electron always, or a wide browser window.
 * Phone-width web and native mobile keep the existing layouts.
 */
export function useIsDesktopLayout(): boolean {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return false;
  if (isElectronDesktop()) return true;
  return width >= DESKTOP_LAYOUT_MIN_WIDTH;
}

export function isAuthPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0] ?? pathname;
  return (
    path === '/login' ||
    path === '/register' ||
    path === '/register-parent' ||
    path === '/forgot-password' ||
    path === '/account-select' ||
    path === '/parent-sign-in' ||
    path === '/teacher-sign-in'
  );
}

export function isAuthSegments(segments: string[]): boolean {
  const first = segments[0] ?? '';
  return [
    'login',
    'register',
    'register-parent',
    'forgot-password',
    'account-select',
    'parent-sign-in',
    'teacher-sign-in',
  ].includes(first);
}

export function isReaderPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0] ?? pathname;
  return (
    path.includes('/pdf-reader') ||
    path.includes('/pdf-viewer') ||
    /\/igcse\/reader(\/|$)/.test(path)
  );
}

export function isReaderSegments(segments: string[]): boolean {
  return (
    segments.includes('pdf-reader') ||
    segments.includes('pdf-viewer') ||
    (segments[0] === 'igcse' && segments[1] === 'reader')
  );
}
