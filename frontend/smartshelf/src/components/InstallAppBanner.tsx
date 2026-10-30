import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { isElectronDesktop, isReaderPath } from '@/src/lib/desktop';

const DISMISS_KEY = 'smartshelf:install-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function alreadyInstalled(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

/** Chrome/Edge install offer. The browser decides when this can appear. */
export function InstallAppBanner() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (isElectronDesktop() || alreadyInstalled()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // Private mode can block storage. The banner can still show.
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (dismissed.current) return;
      setPromptEvent(event as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setHidden(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    dismissed.current = true;
    setHidden(true);
    setPromptEvent(null);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore storage failures.
    }
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome !== 'accepted') dismiss();
    else setHidden(true);
  };

  if (Platform.OS !== 'web' || hidden || !promptEvent || isReaderPath(pathname)) return null;

  const wide = width >= 720;

  return (
    <View pointerEvents="box-none" style={styles.host}>
    <View style={[styles.banner, wide ? styles.bannerWide : styles.bannerPhone]}>
      <Image source={require('@/assets/images/ss-logo.png')} style={styles.logo} resizeMode="contain" />
      <View style={styles.copy}>
        <ThemedText style={styles.title}>Install SmartShelf</ThemedText>
        <ThemedText style={styles.body}>Add it to this device and open it in its own window.</ThemedText>
        <View style={styles.actions}>
          <Pressable onPress={dismiss} style={styles.later} accessibilityRole="button">
            <ThemedText style={styles.laterText}>Not now</ThemedText>
          </Pressable>
          <Pressable onPress={() => void install()} style={styles.install} accessibilityRole="button">
            <ThemedText style={styles.installText}>Install</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    ...({ position: 'fixed' } as object),
  },
  banner: {
    position: 'absolute',
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 14,
  },
  bannerWide: {
    right: 24,
    bottom: 96,
    width: 380,
  },
  bannerPhone: {
    left: 12,
    right: 12,
    bottom: 12,
  },
  logo: {
    width: 48,
    height: 48,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: '#B5B5B5',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  later: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  laterText: {
    color: '#D0D0D0',
    fontSize: 14,
    fontWeight: '600',
  },
  install: {
    backgroundColor: '#00FF41',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  installText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
