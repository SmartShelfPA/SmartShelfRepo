import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ShelfViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ shelfId: string | string[] }>();
  const shelfId = Array.isArray(params.shelfId) ? params.shelfId[0] : params.shelfId;
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useColorScheme() === 'dark' ? '#fff' : '#00FF41';

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.title, { color: textColor }]}>Shelf</ThemedText>
      </View>
      <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        <ThemedText style={[styles.shelfId, { color: textColor }]}>
          shelfId: {shelfId ?? '—'}
        </ThemedText>
      </View>
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
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  shelfId: {
    fontSize: 14,
    opacity: 0.8,
  },
});
