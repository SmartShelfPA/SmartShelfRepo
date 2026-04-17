import { useState, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, FlatList, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Textbook } from '@/components/textbook-preview-list';
import { Image } from 'expo-image';

export default function SubjectTextbooksScreen() {
  const params = useLocalSearchParams();
  const subject = (params.subject as string) || 'Unknown';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();

  // Sample textbooks data - in a real app, this would come from an API
  const allTextbooks: Textbook[] = [
    {
      id: '1',
      title: 'Mathematics for IGCSE',
      subject: 'Mathematics',
      examTags: ['IGCSE'],
      coverUri: undefined,
    },
    {
      id: '2',
      title: 'Advanced Mathematics WAEC',
      subject: 'Mathematics',
      examTags: ['WAEC'],
      coverUri: undefined,
    },
    {
      id: '3',
      title: 'Mathematics Fundamentals',
      subject: 'Mathematics',
      examTags: ['IGCSE', 'WAEC'],
      coverUri: undefined,
    },
    {
      id: '4',
      title: 'Physics for IGCSE',
      subject: 'Physics',
      examTags: ['IGCSE'],
      coverUri: undefined,
    },
    {
      id: '5',
      title: 'Physics WAEC Guide',
      subject: 'Physics',
      examTags: ['WAEC'],
      coverUri: undefined,
    },
    {
      id: '6',
      title: 'Modern Physics',
      subject: 'Physics',
      examTags: ['IGCSE'],
      coverUri: undefined,
    },
    {
      id: '7',
      title: 'Chemistry IGCSE Workbook',
      subject: 'Chemistry',
      examTags: ['IGCSE'],
      coverUri: undefined,
    },
    {
      id: '8',
      title: 'Organic Chemistry Guide',
      subject: 'Chemistry',
      examTags: ['WAEC'],
      coverUri: undefined,
    },
  ];

  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const tagBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  // Filter textbooks by subject and search query
  const filteredTextbooks = useMemo(() => {
    return allTextbooks.filter(
      (book) =>
        book.subject.toLowerCase() === subject.toLowerCase() &&
        (searchQuery.trim() === '' ||
          book.title.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    );
  }, [subject, searchQuery]);

  const renderTextbook = ({ item }: { item: Textbook }) => (
    <TouchableOpacity
      style={[styles.textbookCard, { backgroundColor: cardBgColor, borderColor }]}
      onPress={() => {
        // Navigate to textbook detail or open textbook
        console.log('Textbook pressed:', item.id);
      }}
      activeOpacity={0.7}>
      <View style={styles.coverContainer}>
        {item.coverUri ? (
          <Image source={{ uri: item.coverUri }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: tagBgColor }]}>
            <ThemedText style={[styles.coverPlaceholderText, { color: mutedTextColor }]}>
              {item.title.charAt(0)}
            </ThemedText>
          </View>
        )}
      </View>
      <View style={styles.textbookInfo}>
        <ThemedText
          style={[styles.textbookTitle, { color: textColor }]}
          numberOfLines={2}>
          {item.title}
        </ThemedText>
        <View style={styles.tagsContainer}>
          {item.examTags.map((tag, index) => (
            <View
              key={`${tag}-${index}`}
              style={[styles.tag, { backgroundColor: tagBgColor }]}>
              <ThemedText style={[styles.tagText, { color: tintColor }]}>
                {tag}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]} type="defaultSemiBold">
          {subject}
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputContainer, { backgroundColor: cardBgColor, borderColor }]}>
          <MaterialIcons name="search" size={20} color={mutedTextColor} />
          <ThemedTextInput
            style={styles.searchInput}
            placeholder="Search textbooks..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={20} color={mutedTextColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Textbooks List */}
      <FlatList
        data={filteredTextbooks}
        renderItem={renderTextbook}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="menu-book" size={48} color={mutedTextColor} />
            <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
              {searchQuery
                ? `No textbooks found for "${searchQuery}"`
                : `No textbooks available for ${subject}`}
            </ThemedText>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    borderWidth: 0,
    padding: 0,
    margin: 0,
    minHeight: 'auto',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  row: {
    justifyContent: 'space-between',
    gap: 12,
  },
  textbookCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  coverContainer: {
    width: '100%',
    height: 180,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  textbookInfo: {
    padding: 12,
    gap: 8,
  },
  textbookTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
