import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePathname, useSegments } from 'expo-router';

import { DesktopSearchOverlay } from '@/src/components/desktop/DesktopSearchOverlay';
import { DesktopSidebar } from '@/src/components/desktop/DesktopSidebar';
import { NowReadingBar } from '@/src/components/desktop/NowReadingBar';
import { useDesktopShortcuts } from '@/src/hooks/useDesktopShortcuts';
import {
  isAuthPath,
  isAuthSegments,
  isReaderPath,
  isReaderSegments,
  useIsDesktopLayout,
} from '@/src/lib/desktop';
import { useAuthStore } from '@/src/store/auth';

const SCROLLBAR_STYLE_ID = 'smartshelf-always-visible-scrollbars';

const SCROLLBAR_CSS = `
  html {
    scrollbar-gutter: stable;
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.45) rgba(0, 0, 0, 0.35);
  }

  *::-webkit-scrollbar {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
  }

  *::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.35);
  }

  *::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.45);
    border-radius: 8px;
    border: 2px solid rgba(0, 0, 0, 0.35);
  }

  *::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.6);
  }
`;

function ensureDesktopScrollbarStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SCROLLBAR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SCROLLBAR_STYLE_ID;
  style.textContent = SCROLLBAR_CSS;
  document.head.appendChild(style);
}

/**
 * Electron / wide-web: sidebar + Now Reading bar (SoundCloud-style chrome).
 * Phone-width web and native: unchanged full-screen layouts.
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const isWeb = Platform.OS === 'web';
  const desktop = useIsDesktopLayout();
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const readerFocus = isReaderSegments(segments) || isReaderPath(pathname);
  const authRoute = isAuthSegments(segments) || isAuthPath(pathname);
  const showChrome = isWeb && desktop && authenticated && !authRoute;

  useDesktopShortcuts(showChrome);

  useEffect(() => {
    if (!isWeb) return;
    ensureDesktopScrollbarStyles();
  }, [isWeb]);

  if (!isWeb) {
    return <>{children}</>;
  }

  if (!showChrome) {
    return <View style={styles.webRoot}>{children}</View>;
  }

  return (
    <View style={styles.app}>
      <View style={styles.row}>
        {readerFocus ? null : <DesktopSidebar />}
        <View style={styles.main}>{children}</View>
      </View>
      {readerFocus ? null : <NowReadingBar />}
      <DesktopSearchOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  app: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121212',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
