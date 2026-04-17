import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface Textbook {
  id: string;
  title: string;
  subject: string;
  examTags: ('IGCSE' | 'WAEC')[];
  coverUri?: string;
}

export interface TextbookPreviewListProps {
  textbooks: Textbook[];
  isLoading?: boolean;
  onViewAll?: () => void;
  onTextbookPress?: (textbook: Textbook) => void;
}

export function TextbookPreviewList({
  textbooks,
  isLoading = false,
  onViewAll,
  onTextbookPress,
}: TextbookPreviewListProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const tagBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green

  const renderTextbook = ({ item }: { item: Textbook }) => (
    <TouchableOpacity
      style={[styles.textbookCard, { backgroundColor: cardBgColor }]}
      onPress={() => onTextbookPress?.(item)}
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
        <ThemedText style={[styles.textbookSubject, { color: mutedTextColor }]}>
          {item.subject}
        </ThemedText>
        <View style={styles.tagsContainer}>
          {item.examTags.map((tag) => (
            <View
              key={tag}
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

  const renderSkeleton = () => (
    <View style={[styles.textbookCard, { backgroundColor: cardBgColor }]}>
      <View style={[styles.coverContainer, { backgroundColor: tagBgColor }]} />
      <View style={styles.textbookInfo}>
        <View style={[styles.skeletonLine, { backgroundColor: tagBgColor }]} />
        <View style={[styles.skeletonLine, { backgroundColor: tagBgColor, width: '60%' }]} />
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]} type="defaultSemiBold">
          Textbook Library
        </ThemedText>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
            <ThemedText style={[styles.viewAllText, { color: tintColor }]}>
              View all
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <FlatList
          horizontal
          data={[1, 2, 3]}
          renderItem={renderSkeleton}
          keyExtractor={(item) => item.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : textbooks.length > 0 ? (
        <FlatList
          horizontal
          data={textbooks}
          renderItem={renderTextbook}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
            No textbooks available
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  textbookCard: {
    width: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  coverContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#E5E5E5',
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
    gap: 4,
  },
  textbookTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  textbookSubject: {
    fontSize: 12,
    marginBottom: 6,
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
  skeletonLine: {
    height: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});

