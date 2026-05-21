import { useMemo } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  IgcseEmptyState,
  IgcseErrorState,
  IgcseListSkeleton,
  IgcseTextbookCard,
} from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';
import { useIgcsShelf } from '@/src/hooks/useIgcsShelf';
import type { IgcsTextbook } from '@/src/types/igcse';

/**
 * EPUB textbook grid — data from `GET /api/v1/igcse/books/` (Django `learning` app).
 */
export default function IgcsEpubBooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();
  const { books, isLoading, error, refetch, empty } = useIgcsShelf();

  const sorted = useMemo(
    () =>
      [...books].sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
      ),
    [books]
  );

  const renderItem = ({ item }: { item: IgcsTextbook }) => (
    <IgcseTextbookCard
      book={item}
      textColor={theme.textColor}
      mutedColor={theme.mutedTextColor}
      tintColor={theme.tintColor}
      cardBg={theme.cardBgColor}
      tagBg={theme.borderColor}
      onOpen={() => router.push({ pathname: '/igcse/reader/[id]', params: { id: item.id } } as Href)}
      onDetails={() => router.push({ pathname: '/igcse/book/[id]', params: { id: item.id } } as Href)}
    />
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 16), borderBottomColor: theme.borderColor },
        ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={theme.tintColor} />
        </TouchableOpacity>
        <ThemedText type="title">IGCSE textbooks</ThemedText>
        <TouchableOpacity onPress={() => void refetch()} style={styles.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="refresh" size={22} color={theme.tintColor} />
        </TouchableOpacity>
      </View>
      <ThemedText style={[styles.subtitle, { color: theme.mutedTextColor }]}>
        Served from SmartShelf · tap to read, info for synopsis
      </ThemedText>

      {isLoading ? (
        <IgcseListSkeleton
          message="Loading textbooks…"
          tintColor={theme.tintColor}
          mutedColor={theme.mutedTextColor}
        />
      ) : error ? (
        <IgcseErrorState
          message={error}
          onRetry={() => void refetch()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : empty ? (
        <IgcseEmptyState
          icon="menu-book"
          title="No textbooks yet"
          message="Ask your admin to add EPUB titles in Django admin (Learning → IGCSE EPUB books)."
          actionLabel="Refresh"
          onAction={() => void refetch()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
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
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 6 },
  subtitle: { paddingHorizontal: 16, marginTop: 8, marginBottom: 12, fontSize: 14 },
  list: { paddingHorizontal: 16, gap: 12 },
  row: { justifyContent: 'space-between', gap: 12 },
});
