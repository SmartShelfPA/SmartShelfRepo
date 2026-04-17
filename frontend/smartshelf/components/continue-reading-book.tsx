import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface ContinueReadingBookProps {
  coverImage?: string | number;
  title: string;
  progress: number; // 0-100
}

export function ContinueReadingBook({ coverImage, title, progress }: ContinueReadingBookProps) {
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');

  return (
    <ThemedView style={[styles.container, { borderColor }]}>
      <View style={styles.imageContainer}>
        {coverImage ? (
          <Image
            source={typeof coverImage === 'string' ? { uri: coverImage } : coverImage}
            style={styles.coverImage}
            contentFit="cover"
          />
        ) : (
          <ThemedView style={[styles.placeholderImage, { backgroundColor: borderColor }]}>
            <ThemedText style={styles.placeholderText}>📖</ThemedText>
          </ThemedView>
        )}
      </View>
      <ThemedText style={styles.title} numberOfLines={2}>
        {title}
      </ThemedText>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBarBackground, { backgroundColor: borderColor }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: tintColor },
            ]}
          />
        </View>
        <ThemedText style={styles.progressText}>{Math.round(progress)}%</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    marginRight: 16,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    marginBottom: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  placeholderText: {
    fontSize: 48,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    minHeight: 40,
  },
  progressContainer: {
    gap: 4,
  },
  progressBarBackground: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    opacity: 0.3,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    opacity: 0.7,
  },
});

