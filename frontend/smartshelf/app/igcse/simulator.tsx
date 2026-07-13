import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IgcseErrorState } from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';

const PRINT_JS = `
(function() {
  try { window.print(); } catch(e) {}
  true;
})();
`;

/** Dismiss the native loading veil even if the SPA keeps fetching (e.g. transformers.js models). */
const INITIAL_LOAD_DISMISS_MS = 4500;

export default function IgcsSimulatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();
  const webRef = useRef<WebView>(null);
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
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(() => {
      finishInitialLoad();
    }, INITIAL_LOAD_DISMISS_MS);
    webRef.current?.reload();
  }, [clearDismissTimer, finishInitialLoad]);

  const onOpenInBrowser = useCallback(async () => {
    const pageUrl = currentUrlRef.current || url;
    if (!pageUrl) return;
    await WebBrowser.openBrowserAsync(pageUrl);
  }, [url]);

  const onNavigationChange = useCallback((nav: WebViewNavigation) => {
    currentUrlRef.current = nav.url;
  }, []);

  const onDownload = useCallback(async () => {
    const pageUrl = currentUrlRef.current || url;
    const isDirectFile = /\.(pdf|doc|docx|epub|zip)(\?|$)/i.test(pageUrl);

    if (isDirectFile) {
      await WebBrowser.openBrowserAsync(pageUrl);
      return;
    }

    if (Platform.OS === 'ios') {
      webRef.current?.injectJavaScript(PRINT_JS);
    } else {
      await WebBrowser.openBrowserAsync(pageUrl);
    }
  }, [url]);

  const handleFileDownload = useCallback(async (event: { nativeEvent: { downloadUrl: string } }) => {
    const fileUrl = event.nativeEvent.downloadUrl;
    if (!fileUrl) return;
    await WebBrowser.openBrowserAsync(fileUrl);
  }, []);

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
        <TouchableOpacity
          onPress={onDownload}
          style={styles.iconBtn}
          activeOpacity={0.85}
          disabled={loading}>
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
          <WebView
            ref={webRef}
            source={{ uri: url }}
            style={styles.web}
            onNavigationStateChange={onNavigationChange}
            onLoadStart={() => {
              // Only block interaction on the very first document load — not SPA route changes
              // when the user taps "Start" (transformers.js can keep loading for minutes).
              if (!initialLoadDoneRef.current) {
                setLoading(true);
              }
              setError(null);
            }}
            onLoadEnd={() => {
              finishInitialLoad();
            }}
            onError={(e) => {
              finishInitialLoad();
              setError(e.nativeEvent.description || 'Could not load simulator');
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 400) {
                finishInitialLoad();
                setError(`Simulator returned HTTP ${e.nativeEvent.statusCode}`);
              }
            }}
            onFileDownload={handleFileDownload}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            cacheEnabled
            allowsInlineMediaPlayback
            mixedContentMode="always"
            originWhitelist={['*']}
            startInLoadingState
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
          />
          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={theme.tintColor} />
              <ThemedText style={{ color: theme.mutedTextColor, marginTop: 12 }}>
                Loading simulator…
              </ThemedText>
              <ThemedText style={{ color: theme.mutedTextColor, marginTop: 8, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 }}>
                If grading stays stuck, tap the browser icon above to open in Chrome.
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
  webWrap: { flex: 1 },
  web: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
