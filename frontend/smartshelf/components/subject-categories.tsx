import React from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface SubjectCategory {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

export interface SubjectCategoriesProps {
  categories: SubjectCategory[];
  onCategoryPress: (category: SubjectCategory) => void;
}

export function SubjectCategories({
  categories,
  onCategoryPress,
}: SubjectCategoriesProps) {
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();

  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const iconBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const getSubjectIcon = (subjectName: string): keyof typeof MaterialIcons.glyphMap => {
    const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
      Mathematics: 'calculate',
      Physics: 'science',
      Chemistry: 'biotech',
      Biology: 'eco',
      English: 'menu-book',
      History: 'history-edu',
      Geography: 'public',
      Economics: 'trending-up',
      Literature: 'auto-stories',
    };
    return iconMap[subjectName] || 'menu-book';
  };

  const renderCategory = ({ item }: { item: SubjectCategory }) => (
    <TouchableOpacity
      style={[styles.categoryCard, { backgroundColor: cardBgColor }]}
      onPress={() => onCategoryPress(item)}
      activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <MaterialIcons
          name={getSubjectIcon(item.name)}
          size={32}
          color={tintColor}
        />
      </View>
      <ThemedText style={[styles.categoryName, { color: textColor }]} type="defaultSemiBold">
        {item.name}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]} type="defaultSemiBold">
          Subject Categories
        </ThemedText>
      </View>

      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  row: {
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 16,
    textAlign: 'center',
  },
});
