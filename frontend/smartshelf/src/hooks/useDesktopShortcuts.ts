import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useDesktopChromeStore } from '@/src/store/desktopChrome';
import { resumeNowReading } from '@/src/store/nowReading';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/** Ctrl/Cmd+K search, Ctrl/Cmd+B shelf, Ctrl/Cmd+R resume. */
export function useDesktopShortcuts(enabled: boolean) {
  const router = useRouter();
  const openSearch = useDesktopChromeStore((s) => s.openSearch);
  const closeSearch = useDesktopChromeStore((s) => s.closeSearch);
  const toggleSidebar = useDesktopChromeStore((s) => s.toggleSidebar);
  const searchOpen = useDesktopChromeStore((s) => s.searchOpen);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) {
        if (event.key === 'Escape' && searchOpen) {
          closeSearch();
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (key === 'b' && !isTypingTarget(event.target)) {
        event.preventDefault();
        toggleSidebar();
        return;
      }
      if (key === 'r' && !isTypingTarget(event.target)) {
        event.preventDefault();
        void resumeNowReading(router);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, router, openSearch, closeSearch, toggleSidebar, searchOpen]);
}
