import { StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ContinueReadingBook, ContinueReadingBookProps } from './continue-reading-book';

export interface ContinueReadingSectionProps {
  books: ContinueReadingBookProps[];
}

export function ContinueReadingSection({ books }: ContinueReadingSectionProps) {
  if (books.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Continue Reading
        </ThemedText>
        <ThemedText style={styles.emptyText}>No books in progress</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Continue Reading
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}>
        {books.map((book, index) => (
          <ContinueReadingBook key={index} {...book} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  scrollView: {
    marginHorizontal: -4,
  },
  scrollContent: {
    paddingHorizontal: 4,
  },
  emptyText: {
    paddingHorizontal: 4,
    opacity: 0.6,
  },
});

