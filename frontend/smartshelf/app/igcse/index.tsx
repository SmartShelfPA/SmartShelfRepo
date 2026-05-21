import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
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
  IgcseShelfTile,
  IgcseSubjectCard,
  IgcseTextbookCard,
} from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';
import { useIgcsShelfHub } from '@/src/hooks/useIgcsShelfHub';

/**
 * IGCSE shelf hub — previews textbooks (`/api/v1/igcse/books/`) and study subjects (`/api/igcse/subjects/`).
 */
export default function IgcseHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();
  const {
    books,
    subjects,
    booksLoading,
    subjectsLoading,
    booksError,
    subjectsError,
    loading,
    allFailed,
    refetch,
    booksEmpty,
    subjectsEmpty,
  } = useIgcsShelfHub();

  const bookPreview = books.slice(0, 4);
  const subjectPreview = subjects.slice(0, 6);

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={theme.tintColor} />
        </TouchableOpacity>
        <ThemedText type="title">IGCSE shelf</ThemedText>
        <TouchableOpacity onPress={() => void refetch()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="refresh" size={22} color={theme.tintColor} />
        </TouchableOpacity>
      </View>
      <ThemedText style={[styles.subtitle, { color: theme.mutedTextColor }]}>
        Textbooks and AI-generated practice packs from your SmartShelf backend.
      </ThemedText>

      {loading ? (
        <IgcseListSkeleton
          message="Loading shelf…"
          tintColor={theme.tintColor}
          mutedColor={theme.mutedTextColor}
        />
      ) : allFailed ? (
        <IgcseErrorState
          message={[booksError, subjectsError].filter(Boolean).join('\n')}
          onRetry={() => void refetch()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHead}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textColor }]}>Textbooks</ThemedText>
            <TouchableOpacity onPress={() => router.push('/igcse/books' as Href)} activeOpacity={0.85}>
              <ThemedText style={{ color: theme.tintColor, fontWeight: '700', fontSize: 13 }}>See all</ThemedText>
            </TouchableOpacity>
          </View>

          {booksLoading ? (
            <ThemedText style={{ color: theme.mutedTextColor, paddingHorizontal: 16, fontSize: 13 }}>
              Loading textbooks…
            </ThemedText>
          ) : booksError ? (
            <View style={[styles.inlineNotice, { borderColor: theme.borderColor }]}>
              <ThemedText style={{ color: theme.mutedTextColor, fontSize: 13 }}>{booksError}</ThemedText>
            </View>
          ) : booksEmpty ? (
            <IgcseEmptyState
              icon="menu-book"
              title="No textbooks"
              message="EPUB titles appear here once added in Django admin."
              mutedColor={theme.mutedTextColor}
              tintColor={theme.tintColor}
            />
          ) : (
            <View style={styles.bookGrid}>
              {bookPreview.map((book) => (
                <IgcseTextbookCard
                  key={book.id}
                  book={book}
                  textColor={theme.textColor}
                  mutedColor={theme.mutedTextColor}
                  tintColor={theme.tintColor}
                  cardBg={theme.cardBgColor}
                  tagBg={theme.borderColor}
                  onOpen={() =>
                    router.push({ pathname: '/igcse/reader/[id]', params: { id: book.id } } as Href)
                  }
                  onDetails={() =>
                    router.push({ pathname: '/igcse/book/[id]', params: { id: book.id } } as Href)
                  }
                />
              ))}
            </View>
          )}

          <View style={[styles.sectionHead, styles.sectionGap]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textColor }]}>
              Study resources
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/igcse/revision' as Href)} activeOpacity={0.85}>
              <ThemedText style={{ color: theme.tintColor, fontWeight: '700', fontSize: 13 }}>See all</ThemedText>
            </TouchableOpacity>
          </View>

          {subjectsLoading ? (
            <ThemedText style={{ color: theme.mutedTextColor, paddingHorizontal: 16, fontSize: 13 }}>
              Loading subjects…
            </ThemedText>
          ) : subjectsError ? (
            <View style={[styles.inlineNotice, { borderColor: theme.borderColor }]}>
              <ThemedText style={{ color: theme.mutedTextColor, fontSize: 13 }}>{subjectsError}</ThemedText>
            </View>
          ) : subjectsEmpty ? (
            <IgcseEmptyState
              icon="school"
              title="No study packs"
              message="Subjects appear after your admin ingests study-agent content."
              mutedColor={theme.mutedTextColor}
              tintColor={theme.tintColor}
            />
          ) : (
            <View style={styles.subjectList}>
              {subjectPreview.map((subject) => (
                <IgcseSubjectCard
                  key={subject.id}
                  subject={subject}
                  onPress={() =>
                    router.push({
                      pathname: '/igcse/revision/[subject]',
                      params: { subject: subject.id },
                    } as Href)
                  }
                  textColor={theme.textColor}
                  mutedColor={theme.mutedTextColor}
                  tintColor={theme.tintColor}
                  borderColor={theme.borderColor}
                  cardBg={theme.cardBgColor}
                />
              ))}
            </View>
          )}

          <View style={styles.tiles}>
            <IgcseShelfTile
              title="All textbooks"
              description="Full EPUB catalog, reader, bookmarks, and notes."
              icon="chrome-reader-mode"
              onPress={() => router.push('/igcse/books' as Href)}
              textColor={theme.textColor}
              mutedColor={theme.mutedTextColor}
              tintColor={theme.tintColor}
              borderColor={theme.borderColor}
              cardBg={theme.cardBgColor}
            />
            <IgcseShelfTile
              title="All study resources"
              description="Practice papers, solutions, and simulators by chapter."
              icon="school"
              onPress={() => router.push('/igcse/revision' as Href)}
              textColor={theme.textColor}
              mutedColor={theme.mutedTextColor}
              tintColor={theme.tintColor}
              borderColor={theme.borderColor}
              cardBg={theme.cardBgColor}
            />
          </View>
        </ScrollView>
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
  },
  backBtn: { padding: 6 },
  subtitle: { paddingHorizontal: 16, marginTop: 8, marginBottom: 12, fontSize: 14, lineHeight: 20 },
  scroll: { gap: 8 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionGap: { marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  bookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  subjectList: { paddingHorizontal: 16, gap: 10 },
  inlineNotice: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tiles: { paddingHorizontal: 16, gap: 14, marginTop: 24 },
});
