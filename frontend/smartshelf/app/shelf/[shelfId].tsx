import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRequireAuth } from '@/src/hooks/useRequireRole';
import { prepareProtectedOpen } from '@/src/lib/protectedPdfAccess';
import { type Book, useBooksStore } from '@/src/store/books';
import { useCollectionsStore } from '@/src/store/collections';

export default function ShelfViewScreen() {
  const ready = useRequireAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ shelfId: string | string[] }>();
  const shelfId = Array.isArray(params.shelfId) ? params.shelfId[0] : params.shelfId;
  const collection = useCollectionsStore((s) => s.collections.find((item) => item.id === shelfId));
  const books = useBooksStore((s) => s.books);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useColorScheme() === 'dark' ? '#fff' : '#00FF41';
  const mutedTextColor = useColorScheme() === 'dark' ? '#9BA1A6' : '#687076';
  const cardBgColor = useColorScheme() === 'dark' ? '#1F1F1F' : '#FFFFFF';

  const shelfBooks = useMemo(() => {
    if (!collection) return [];
    return collection.bookIds
      .map((id) => books.find((book) => book.id === id))
      .filter((book): book is Book => Boolean(book));
  }, [books, collection]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/bookshelf');
  };

  const openBook = async (item: Book) => {
    if (item.igcseAssetId) {
      const result = await prepareProtectedOpen(item.igcseAssetId);
      if (result.ok) {
        router.push({
          pathname: '/igcse/pdf-reader',
          params: {
            localUri: result.localUri,
            bookId: item.igcseAssetId,
            title: item.title,
          },
        });
        return;
      }
      Alert.alert(
        result.reason === 'not_downloaded' ? 'Download required' : 'Cannot open',
        result.message
      );
      return;
    }
    router.push({ pathname: '/book/[id]', params: { id: item.id } });
  };

  if (!ready) return null;

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={tintColor} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <ThemedText style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {collection?.name ?? 'Shelf'}
          </ThemedText>
          {collection ? (
            <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
              {shelfBooks.length} {shelfBooks.length === 1 ? 'book' : 'books'}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {!collection ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="collections-bookmark" size={48} color={mutedTextColor} />
            <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
              This shelf is not on this browser. Collections stay on the device where they were created.
            </ThemedText>
          </View>
        ) : shelfBooks.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="menu-book" size={48} color={mutedTextColor} />
            <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
              This shelf is empty.
            </ThemedText>
          </View>
        ) : (
          shelfBooks.map((book) => (
            <TouchableOpacity
              key={book.id}
              style={[styles.bookRow, { backgroundColor: cardBgColor }]}
              onPress={() => void openBook(book)}
              activeOpacity={0.85}>
              <MaterialIcons name="menu-book" size={22} color={tintColor} />
              <View style={styles.bookText}>
                <ThemedText style={[styles.bookTitle, { color: textColor }]} numberOfLines={2}>
                  {book.title}
                </ThemedText>
                <ThemedText style={[styles.bookMeta, { color: mutedTextColor }]} numberOfLines={1}>
                  {book.subject}
                </ThemedText>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
  },
  bookText: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  bookMeta: {
    fontSize: 13,
  },
});
