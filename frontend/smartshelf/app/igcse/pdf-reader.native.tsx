import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useBookLastPage } from '@/src/hooks/useBookLastPage';

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

  const { getLastPage, saveLastPage } = useBookLastPage(bookId ?? '');

  const [initialPage, setInitialPage] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setInitialPage(1);
      return;
    }
    void getLastPage().then((p) => setInitialPage(p));
  }, [bookId, getLastPage]);

  const handlePageChanged = useCallback(
    (page: number, pages: number) => {
      setCurrentPage(page);
      if (pages > 0) setTotalPages(pages);
      if (bookId) void saveLastPage(page);
    },
    [bookId, saveLastPage]
  );

  const sourceUri = (localUri as string) || (url as string) || '';

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
        {totalPages > 0 ? (
          <Text style={[styles.pageLabel, { color: iconColor + 'aa' }]}>
            {currentPage} / {totalPages}
          </Text>
        ) : (
          <View style={styles.pageLabel} />
        )}
      </View>

      {initialPage !== null && !error && (
        <Pdf
          key={sourceUri}
          source={{ uri: sourceUri, cache: true }}
          page={initialPage}
          onLoadComplete={(pages) => {
            setTotalPages(pages);
            setLoading(false);
          }}
          onPageChanged={handlePageChanged}
          onError={(err) => {
            setLoading(false);
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg || 'Failed to load PDF.');
          }}
          style={[styles.pdf, { backgroundColor: bgColor }]}
          trustAllCerts={false}
          enablePaging={false}
          horizontal={false}
          fitPolicy={0}
        />
      )}

      {loading && !error && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: bgColor }]}>
          <ActivityIndicator size="large" color="#00FF41" />
          <Text style={[styles.loadingMsg, { color: iconColor }]}>
            {localUri ? 'Opening local copy…' : 'Loading PDF…'}
          </Text>
        </View>
      )}

      {error ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: bgColor }]}>
          <MaterialIcons name="error-outline" size={48} color="#e53935" />
          <Text style={[styles.errorMsg, { color: iconColor }]}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setError(null);
              setLoading(true);
            }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
  pageLabel: { width: 64, fontSize: 12, textAlign: 'right', flexShrink: 0 },
  pdf: { flex: 1 },
  loadingMsg: { fontSize: 14, marginTop: 8 },
  absoluteBack: { position: 'absolute', top: 16, left: 16 },
  errorMsg: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#00FF41',
    borderRadius: 8,
    marginTop: 4,
  },
  retryBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
