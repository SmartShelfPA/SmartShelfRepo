import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { useBooksStore } from '@/src/store/books';
import { useDesktopChromeStore } from '@/src/store/desktopChrome';
import { useNowReadingStore } from '@/src/store/nowReading';

type Hit = {
  id: string;
  title: string;
  subtitle: string;
  href: Href;
};

const DESTINATIONS: Hit[] = [
  { id: 'd-home', title: 'Home', subtitle: 'Continue reading and practice', href: '/(tabs)' },
  { id: 'd-shelf', title: 'My Shelf', subtitle: 'Saved textbooks and collections', href: '/(tabs)/bookshelf' },
  { id: 'd-downloads', title: 'Downloads', subtitle: 'Offline textbooks', href: '/downloads' },
  { id: 'd-igcse', title: 'IGCSE textbooks', subtitle: 'Protected PDFs', href: '/igcse/books' },
  { id: 'd-waec', title: 'WAEC practice', subtitle: 'Exam practice', href: '/practice/waec' },
  { id: 'd-jamb', title: 'JAMB practice', subtitle: 'Exam practice', href: '/practice/jamb' },
];

export function DesktopSearchOverlay() {
  const router = useRouter();
  const open = useDesktopChromeStore((s) => s.searchOpen);
  const closeSearch = useDesktopChromeStore((s) => s.closeSearch);
  const books = useBooksStore((s) => s.books);
  const recent = useNowReadingStore((s) => s.recent);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bookHits: Hit[] = books.slice(0, 40).map((book) => ({
      id: `b-${book.id}`,
      title: book.title,
      subtitle: [book.subject, ...(book.examTags ?? [])].filter(Boolean).join(' · '),
      href: (book.igcseAssetId
        ? { pathname: '/igcse/books' }
        : { pathname: '/book/[id]', params: { id: book.id } }) as Href,
    }));
    const recentHits: Hit[] = recent.slice(0, 8).map((item) => ({
      id: `r-${item.bookId}`,
      title: item.title,
      subtitle: item.subtitle || 'Recently opened',
      href: (item.kind === 'epub'
        ? `/igcse/reader/${item.bookId}`
        : '/downloads') as Href,
    }));
    const all = [...DESTINATIONS, ...recentHits, ...bookHits];
    if (!q) return all.slice(0, 12);
    return all.filter(
      (hit) =>
        hit.title.toLowerCase().includes(q) || hit.subtitle.toLowerCase().includes(q)
    ).slice(0, 16);
  }, [books, query, recent]);

  const go = (href: Href) => {
    closeSearch();
    router.push(href);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closeSearch}>
      <Pressable style={styles.backdrop} onPress={closeSearch}>
        <Pressable style={styles.panel} onPress={() => undefined}>
          <View style={styles.inputRow}>
            <MaterialIcons name="search" size={22} color="#9a9a9a" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search books, subjects, WAEC, IGCSE…"
              placeholderTextColor="#777"
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          {hits.map((hit) => (
            <TouchableOpacity
              key={hit.id}
              style={styles.hit}
              onPress={() => go(hit.href)}
              activeOpacity={0.85}>
              <MaterialIcons name="north-west" size={16} color="#8d8d8d" />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.hitTitle} numberOfLines={1}>
                  {hit.title}
                </ThemedText>
                <ThemedText style={styles.hitSub} numberOfLines={1}>
                  {hit.subtitle}
                </ThemedText>
              </View>
            </TouchableOpacity>
          ))}
          {hits.length === 0 ? (
            <ThemedText style={styles.empty}>No matches</ThemedText>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    paddingTop: 96,
  },
  panel: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#1b1b1b',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
    overflow: 'hidden',
    paddingBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 6,
  },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hitTitle: { color: '#fff', fontWeight: '700' },
  hitSub: { color: '#8d8d8d', fontSize: 12, marginTop: 2 },
  empty: { color: '#8d8d8d', padding: 16 },
});
