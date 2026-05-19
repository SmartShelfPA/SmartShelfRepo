import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getIGCSEBookDetail } from '@/src/services/igcseEpubService';
import { useIgcsReaderStore } from '@/src/store/igcseReaderStore';
import type { IgcsTextbook } from '@/src/types/igcse';

export default function IgcsBookDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const bookId = Array.isArray(id) ? id[0] : id;

  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const [book, setBook] = useState<IgcsTextbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const progress = useIgcsReaderStore((s) => (bookId ? s.books[bookId]?.progress : undefined));

  useEffect(() => {
    let cancelled = false;
    if (!bookId) {
      setLoading(false);
      setError('Missing book id');
      return undefined;
    }
    setLoading(true);
    setError(null);
    void getIGCSEBookDetail(bookId).then((b) => {
      if (cancelled) return;
      setBook(b);
      setLoading(false);
      if (!b) setError('Book not found');
    });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const pct = useMemo(() => {
    if (progress?.fraction != null) return Math.round(progress.fraction * 100);
    if (typeof book?.progressPercent === 'number') return Math.round(book.progressPercent);
    return 0;
  }, [book?.progressPercent, progress?.fraction]);

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <MaterialIcons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ flex: 1 }}>
            Textbook
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tintColor} />
          </View>
        ) : error || !book ? (
          <View style={styles.center}>
            <MaterialIcons name="menu-book" size={48} color={mutedTextColor} />
            <ThemedText style={{ color: mutedTextColor }}>{error ?? 'Not found'}</ThemedText>
          </View>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: cardBgColor, borderColor }]}>
              <View style={styles.heroIcon}>
                <MaterialIcons name="menu-book" size={32} color={tintColor} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <ThemedText style={[styles.title, { color: textColor }]}>{book.title}</ThemedText>
                <ThemedText style={[styles.meta, { color: mutedTextColor }]}>
                  {book.subject}
                  {book.author ? ` · ${book.author}` : ''}
                </ThemedText>
                {book.description ? (
                  <ThemedText style={[styles.desc, { color: mutedTextColor }]}>
                    {book.description}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            <View style={[styles.progressCard, { backgroundColor: cardBgColor, borderColor }]}>
              <View style={styles.progressRow}>
                <ThemedText style={{ color: mutedTextColor }}>Reading progress</ThemedText>
                <ThemedText style={{ color: textColor, fontWeight: '700' }}>{pct}%</ThemedText>
              </View>
              <View style={[styles.track, { backgroundColor: borderColor }]}>
                <View style={[styles.fill, { backgroundColor: tintColor, width: `${pct}%` }]} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primary, { backgroundColor: tintColor }]}
              onPress={() =>
                router.push({ pathname: '/igcse/reader/[id]', params: { id: book.id } })
              }
              activeOpacity={0.88}>
              <MaterialIcons name="auto-stories" size={22} color="#000" />
              <ThemedText style={styles.primaryText}>Open EPUB reader</ThemedText>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000010',
  },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 14 },
  desc: { fontSize: 13, lineHeight: 18 },
  progressCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  primary: {
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: '#000', fontWeight: '700', fontSize: 16 },
  center: { paddingVertical: 48, alignItems: 'center', gap: 12 },
});
