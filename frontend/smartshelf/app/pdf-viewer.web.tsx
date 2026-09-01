import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useNowReadingStore } from '@/src/store/nowReading';
import { buildPdfViewerSrc } from '@/src/lib/pdfViewerUrl';

/** Web/Electron PDF viewer — same-origin PDF.js iframe. */
export default function PdfViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor({}, 'text');
  const bgColor = useThemeColor({}, 'background');
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const source = (url ?? '').trim();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!title && !source) return;
    useNowReadingStore.getState().setSession({
      kind: 'route',
      bookId: source || title || 'pdf',
      title: title || 'PDF',
      subtitle: 'PDF',
      progressPercent: 0,
      href: '/pdf-viewer',
    });
  }, [source, title]);

  const viewerSrc = useMemo(() => (source ? buildPdfViewerSrc(source) : ''), [source]);

  useEffect(() => {
    setReady(Boolean(viewerSrc));
  }, [viewerSrc]);

  if (!source) {
    return (
      <View style={[styles.center, { backgroundColor: bgColor, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <MaterialIcons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <Text style={{ color: iconColor }}>No PDF URL provided.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: iconColor + '22' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: iconColor }]} numberOfLines={1}>
          {title ?? 'PDF'}
        </Text>
      </View>
      <View style={styles.frameWrap}>
        {ready ? (
          <iframe src={viewerSrc} title={title ?? 'PDF'} style={styles.frame as object} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#00FF41" />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', top: 48, left: 12, zIndex: 2, padding: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  iconBtn: { padding: 6 },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  frameWrap: { flex: 1, minHeight: 0 },
  frame: { borderWidth: 0, width: '100%', height: '100%' },
});
