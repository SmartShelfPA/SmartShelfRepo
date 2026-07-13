import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getBackendBaseUrl } from '@/services/api';
import { useBookLastPage } from '@/src/hooks/useBookLastPage';

const PDF_JS_VIEWER = 'https://mozilla.github.io/pdf.js/web/viewer.html';

function buildWebViewerUrl(pdfUrl: string, page: number): string {
  const lower = pdfUrl.toLowerCase();
  if (lower.startsWith('blob:') || lower.startsWith('data:')) {
    return `${PDF_JS_VIEWER}?file=${encodeURIComponent(pdfUrl)}#page=${page}`;
  }
  const base = getBackendBaseUrl();
  const proxy = `${base}/api/pdf-proxy/?url=${encodeURIComponent(pdfUrl)}`;
  return `${PDF_JS_VIEWER}?file=${encodeURIComponent(proxy)}#page=${page}`;
}

/** Web/default PDF reader — uses PDF.js in an iframe (no react-native-pdf). */
export default function IgcsePdfReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor({}, 'text');
  const bgColor = useThemeColor({}, 'background');

  const { url, localUri, bookId, title } = useLocalSearchParams<{
    url: string;
    localUri?: string;
    bookId: string;
    title?: string;
  }>();

  const { getLastPage } = useBookLastPage(bookId ?? '');
  const [initialPage, setInitialPage] = useState(1);
  const [ready, setReady] = useState(false);

  const sourceUri = (localUri as string) || (url as string) || '';

  useEffect(() => {
    if (!bookId) {
      setReady(true);
      return;
    }
    void getLastPage().then((p) => {
      setInitialPage(p);
      setReady(true);
    });
  }, [bookId, getLastPage]);

  const viewerSrc = useMemo(
    () => (sourceUri ? buildWebViewerUrl(sourceUri, initialPage) : ''),
    [sourceUri, initialPage]
  );

  if (!sourceUri) {
    return (
      <View style={[styles.center, { backgroundColor: bgColor, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.absoluteBack}>
          <MaterialIcons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <MaterialIcons name="error-outline" size={40} color="#e53935" />
        <Text style={[styles.errorMsg, { color: iconColor }]}>No PDF source provided.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 4, borderBottomColor: iconColor + '22' },
        ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <Text style={[styles.titleText, { color: iconColor }]} numberOfLines={1}>
          {title ?? 'Textbook'}
        </Text>
      </View>

      <View style={styles.frameWrap}>
        {ready ? (
          // @ts-expect-error iframe is valid on web
          <iframe src={viewerSrc} title={title ?? 'PDF'} style={styles.frame} />
        ) : (
          <View style={[styles.center, { backgroundColor: bgColor }]}>
            <ActivityIndicator size="large" color="#00FF41" />
            <Text style={[styles.loadingMsg, { color: iconColor }]}>Loading PDF…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  iconBtn: { padding: 6, flexShrink: 0 },
  titleText: { flex: 1, fontSize: 15, fontWeight: '600' },
  frameWrap: { flex: 1, minHeight: 0 },
  frame: {
    width: '100%',
    height: '100%',
    border: 'none',
    flex: 1,
  } as object,
  loadingMsg: { fontSize: 14, marginTop: 8 },
  absoluteBack: { position: 'absolute', top: 16, left: 16 },
  errorMsg: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
