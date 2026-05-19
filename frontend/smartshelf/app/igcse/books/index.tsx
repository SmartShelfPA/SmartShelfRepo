import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useIgcsShelf } from '@/src/hooks/useIgcsShelf';
import type { IgcsTextbook } from '@/src/types/igcse';

export default function IgcsEpubBooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const tagBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const { books, isLoading, error, refetch } = useIgcsShelf();

  const sorted = useMemo(
    () =>
      [...books].sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
      ),
    [books]
  );

  const renderItem = ({ item }: { item: IgcsTextbook }) => (
    <View style={[styles.bookCard, { backgroundColor: cardBgColor, shadowColor: '#000' }]}>
      <TouchableOpacity
        style={styles.bookCardMain}
        onPress={() => router.push({ pathname: '/igcse/reader/[id]', params: { id: item.id } })}
        activeOpacity={0.85}>
        <View style={[styles.bookIcon, { backgroundColor: tagBgColor }]}>
          <MaterialIcons name="menu-book" size={28} color={tintColor} />
        </View>
        <ThemedText style={[styles.bookTitle, { color: textColor }]} numberOfLines={2}>
          {item.title}
        </ThemedText>
        <ThemedText style={[styles.bookMeta, { color: mutedTextColor }]}>{item.subject}</ThemedText>
        {typeof item.progressPercent === 'number' && (
          <View style={[styles.progressTrack, { backgroundColor: tagBgColor }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: tintColor,
                  width: `${Math.min(100, Math.max(0, item.progressPercent))}%`,
                },
              ]}
            />
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.bookInfoBtn, { backgroundColor: tagBgColor }]}
        onPress={() => router.push({ pathname: '/igcse/book/[id]', params: { id: item.id } })}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel="Book details">
        <MaterialIcons name="info-outline" size={20} color={tintColor} />
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title">IGCSE textbooks</ThemedText>
        <TouchableOpacity onPress={() => void refetch()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="refresh" size={22} color={tintColor} />
        </TouchableOpacity>
      </View>
      <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
        Tap a book to read · info icon for details and synopsis
      </ThemedText>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tintColor} />
          <ThemedText style={[styles.hint, { color: mutedTextColor }]}>Loading textbooks…</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={48} color={mutedTextColor} />
          <ThemedText style={[styles.hint, { color: mutedTextColor }]}>{error}</ThemedText>
          <TouchableOpacity onPress={() => void refetch()} activeOpacity={0.85}>
            <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Try again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="menu-book" size={48} color={mutedTextColor} />
          <ThemedText style={[styles.hint, { color: mutedTextColor }]}>
            No EPUB catalog entries yet. Use mock books when API is unavailable.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: { padding: 6 },
  subtitle: { paddingHorizontal: 16, marginTop: 6, marginBottom: 12, fontSize: 14 },
  list: { paddingHorizontal: 16, gap: 12 },
  row: { justifyContent: 'space-between', gap: 12 },
  bookCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 12,
    position: 'relative',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookCardMain: {
    borderRadius: 12,
    padding: 16,
    paddingRight: 40,
    gap: 8,
  },
  bookInfoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitle: { fontSize: 14, fontWeight: '600' },
  bookMeta: { fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  hint: { textAlign: 'center', fontSize: 14 },
});
