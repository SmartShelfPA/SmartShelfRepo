import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IgcseErrorState } from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';

export default function IgcsSimulatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();
  const webRef = useRef<WebView>(null);

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

  const onRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
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
            onLoadStart={() => {
              setLoading(true);
              setError(null);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              setError(e.nativeEvent.description || 'Could not load simulator');
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 400) {
                setLoading(false);
                setError(`Simulator returned HTTP ${e.nativeEvent.statusCode}`);
              }
            }}
            startInLoadingState
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
          />
          {loading ? (
            <View style={styles.loadingOverlay}>
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
  webWrap: { flex: 1 },
  web: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
