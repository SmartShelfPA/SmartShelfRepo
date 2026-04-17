import { useMemo, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBookById } from '@/src/store/books';

export default function BookDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const bookId = Array.isArray(id) ? id[0] : id;
  const book = useMemo(() => (bookId ? getBookById(bookId) : undefined), [bookId]);

  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const openPdf = async () => {
    if (!book?.pdfUri) {
      Alert.alert('No PDF', 'No PDF is attached to this textbook.');
      return;
    }
    const canOpen = await Linking.canOpenURL(book.pdfUri);
    if (!canOpen) {
      Alert.alert('Cannot open PDF', 'Your device cannot open this PDF.');
      return;
    }
    await Linking.openURL(book.pdfUri);
  };

  if (!book) {
    return (
      <ThemedView style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText type="defaultSemiBold">Textbook</ThemedText>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyState}>
          <MaterialIcons name="menu-book" size={48} color={mutedTextColor} />
          <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
            Textbook not found.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 16) },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>
            {book.title}
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        <View style={[styles.heroCard, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="menu-book" size={32} color={tintColor} />
          </View>
          <View style={styles.heroContent}>
            <ThemedText style={[styles.bookTitle, { color: textColor }]} numberOfLines={2}>
              {book.title}
            </ThemedText>
            <ThemedText style={[styles.bookMeta, { color: mutedTextColor }]}>
              {book.subject} {book.author ? `• ${book.author}` : ''}
            </ThemedText>
            <View style={styles.tagRow}>
              {book.examTags.map((tag, index) => (
                <View key={`${tag}-${index}`} style={[styles.tag, { backgroundColor: borderColor }]}>
                  <ThemedText style={[styles.tagText, { color: tintColor }]}>{tag}</ThemedText>
                </View>
              ))}
              {book.examTags.length === 0 && (
                <View style={[styles.tag, { backgroundColor: borderColor }]}>
                  <ThemedText style={[styles.tagText, { color: mutedTextColor }]}>Custom</ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: textColor }]} type="defaultSemiBold">
            Connect Toolkit
          </ThemedText>
          <View style={styles.toolGrid}>
            {[
              { label: 'Assignments', icon: 'assignment' },
              { label: 'Quizzes', icon: 'quiz' },
              { label: 'Smart Study', icon: 'auto-awesome' },
              { label: 'Practice', icon: 'school' },
              { label: 'Notes', icon: 'sticky-note-2' },
              { label: 'Calendar', icon: 'event' },
            ].map((tool) => (
              <TouchableOpacity
                key={tool.label}
                style={[styles.toolCard, { backgroundColor: cardBgColor, borderColor }]}
                onPress={() => Alert.alert('Coming soon', `${tool.label} is in progress.`)}
                activeOpacity={0.8}>
                <MaterialIcons name={tool.icon as any} size={24} color={tintColor} />
                <ThemedText style={[styles.toolLabel, { color: textColor }]}>{tool.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: textColor }]} type="defaultSemiBold">
            Textbook Resources
          </ThemedText>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: tintColor }]}
              onPress={openPdf}
              activeOpacity={0.8}>
              <MaterialIcons name="picture-as-pdf" size={20} color="#000" />
              <ThemedText style={[styles.primaryButtonText, { color: '#000' }]}>
                View PDF
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor }]}
              onPress={() => Alert.alert('Coming soon', 'Study plan is in progress.')}
              activeOpacity={0.8}>
              <MaterialIcons name="timeline" size={20} color={textColor} />
              <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>
                Study Plan
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: textColor }]} type="defaultSemiBold">
            Progress Summary
          </ThemedText>
          <View style={[styles.progressCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.progressRow}>
              <ThemedText style={[styles.progressLabel, { color: mutedTextColor }]}>
                Completion
              </ThemedText>
              <ThemedText style={[styles.progressValue, { color: textColor }]}>32%</ThemedText>
            </View>
            <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
              <View style={[styles.progressFill, { backgroundColor: tintColor, width: '32%' }]} />
            </View>
            <ThemedText style={[styles.progressHint, { color: mutedTextColor }]}>
              Keep going — you are making steady progress.
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000010',
  },
  heroContent: {
    flex: 1,
    gap: 6,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  bookMeta: {
    fontSize: 14,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolCard: {
    width: '47%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  toolLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  progressCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 14,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressHint: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
