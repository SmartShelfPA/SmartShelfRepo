import { useEffect } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';

function ensureMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function ensureLink(rel: string, href: string) {
  let tag = document.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

/** Browser tab title, install metadata, and the service worker that caches the app shell. */
export function WebAppShell() {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = 'SmartShelf';
    ensureMeta('theme-color', '#000000');
    ensureMeta('apple-mobile-web-app-title', 'SmartShelf');
    ensureLink('manifest', '/manifest.json');
    ensureLink('icon', '/favicon.png');
    ensureLink('apple-touch-icon', '/icon-192.png');
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator) || __DEV__) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  return null;
}
