import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IgcseShelfTile } from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';

/**
 * IGCSE shelf hub: EPUB textbooks and study-agent generated chapter sets.
 */
export default function IgcseHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={theme.tintColor} />
        </TouchableOpacity>
        <ThemedText type="title">IGCSE shelf</ThemedText>
        <View style={{ width: 36 }} />
      </View>
      <ThemedText style={[styles.subtitle, { color: theme.mutedTextColor }]}>
        Textbooks and AI-generated practice packs served from your SmartShelf backend.
      </ThemedText>

      <View style={[styles.cards, { paddingBottom: insets.bottom + 24 }]}>
        <IgcseShelfTile
          title="Books / EPUB"
          description="Textbook catalog, reader, bookmarks, highlights, and notes."
          icon="chrome-reader-mode"
          onPress={() => router.push('/igcse/books' as Href)}
          textColor={theme.textColor}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
          borderColor={theme.borderColor}
          cardBg={theme.cardBgColor}
        />
        <IgcseShelfTile
          title="Study resources"
          description="Practice papers, worked solutions, and exam simulators by subject and chapter."
          icon="school"
          onPress={() => router.push('/igcse/revision' as Href)}
          textColor={theme.textColor}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
          borderColor={theme.borderColor}
          cardBg={theme.cardBgColor}
        />
      </View>
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
  subtitle: { paddingHorizontal: 16, marginTop: 8, marginBottom: 16, fontSize: 14, lineHeight: 20 },
  cards: { paddingHorizontal: 16, gap: 14 },
});
