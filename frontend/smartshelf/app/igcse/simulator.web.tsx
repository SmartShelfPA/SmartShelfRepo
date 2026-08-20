import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IgcseErrorState } from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';

const INITIAL_LOAD_DISMISS_MS = 4500;

/** Web/Electron simulator — iframe instead of react-native-webview. */
export default function IgcsSimulatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentUrlRef = useRef('');
  const initialLoadDoneRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const params = useLocalSearchParams<{
    url: string | string[];
    title?: string | string[];
  }>();
  const urlRaw = Array.isArray(params.url) ? params.url[0] : params.url;
  const titleRaw = Array.isArray(params.title) ? params.title[0] : params.title;
  const url = (urlRaw ?? '').trim();
  const title = (titleRaw ?? 'Exam simulator').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const finishInitialLoad = useCallback(() => {
    initialLoadDoneRef.current = true;
    clearDismissTimer();
    setLoading(false);
  }, [clearDismissTimer]);

  useEffect(() => {
    initialLoadDoneRef.current = false;
    setLoading(true);
    setError(null);
    currentUrlRef.current = url;
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(() => {
      finishInitialLoad();
    }, INITIAL_LOAD_DISMISS_MS);
    return clearDismissTimer;
  }, [url, clearDismissTimer, finishInitialLoad]);

  const onRetry = useCallback(() => {
    setError(null);
    initialLoadDoneRef.current = false;
    setLoading(true);
    setFrameKey((k) => k + 1);
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(() => {
      finishInitialLoad();
    }, INITIAL_LOAD_DISMISS_MS);
  }, [clearDismissTimer, finishInitialLoad]);

  const onOpenInBrowser = useCallback(async () => {
    const pageUrl = currentUrlRef.current || url;
    if (!pageUrl) return;
    await WebBrowser.openBrowserAsync(pageUrl);
  }, [url]);

  const onDownload = useCallback(async () => {
    const pageUrl = currentUrlRef.current || url;
    if (!pageUrl) return;
    await WebBrowser.openBrowserAsync(pageUrl);
  }, [url]);

  return (
    <ThemedView style={[styles.wrap, { backgroundColor: theme.backgroundColor }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 12),
            borderBottomColor: theme.borderColor,
            backgroundColor: theme.cardBgColor,
          },
        ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="close" size={24} color={theme.tintColor} />
        </TouchableOpacity>
        <ThemedText type="defaultSemiBold" style={{ flex: 1, color: theme.textColor }} numberOfLines={1}>
          {title}
        </ThemedText>
        <TouchableOpacity onPress={onOpenInBrowser} style={styles.iconBtn} activeOpacity={0.85} disabled={!url}>
          <MaterialIcons name="open-in-browser" size={22} color={theme.tintColor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDownload} style={styles.iconBtn} activeOpacity={0.85} disabled={loading}>
          <MaterialIcons name="file-download" size={22} color={theme.tintColor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onRetry} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={22} color={theme.tintColor} />
        </TouchableOpacity>
      </View>

      {!url ? (
        <IgcseErrorState
          message="No simulator URL was provided."
          onRetry={() => router.back()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : error ? (
        <IgcseErrorState
          message={error}
          onRetry={onRetry}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : (
        <View style={styles.webWrap}>
          <iframe
            key={frameKey}
            ref={iframeRef}
            title={title}
            src={url}
            style={styles.frame as object}
            onLoad={() => finishInitialLoad()}
            onError={() => {
              finishInitialLoad();
              setError('Could not load simulator');
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          />
          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={theme.tintColor} />
              <ThemedText style={{ color: theme.mutedTextColor, marginTop: 12 }}>
                Loading simulator…
              </ThemedText>
            </View>
          ) : null}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 8 },
  webWrap: { flex: 1, minHeight: 0, position: 'relative' },
  frame: { borderWidth: 0, width: '100%', height: '100%' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
