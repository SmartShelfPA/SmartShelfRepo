import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';
import { openIgcsSimulator } from '@/src/api/igcseNavigation';
import { getIgcsSimulatorHubUrl } from '@/src/lib/igcseSimulatorUrl';

export default function IgcseHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();

  const sections = [
    {
      key: 'simulator',
      title: 'IGCSE Simulator',
      description: 'MCQ, numeric, and free-text grading. Runs offline — no API key needed.',
      icon: 'quiz' as const,
      onPress: () =>
        openIgcsSimulator(router, {
          url: getIgcsSimulatorHubUrl(),
          title: 'IGCSE Study Agent',
        }),
    },
    {
      key: 'textbooks',
      title: 'IGCSE Textbooks',
      description: 'Browse and read your bundled PDF textbooks.',
      icon: 'menu-book' as const,
      onPress: () => router.push('/igcse/books' as Href),
    },
  ];

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={theme.tintColor} />
        </TouchableOpacity>
        <ThemedText type="title">IGCSE shelf</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.cards, { paddingBottom: insets.bottom + 32 }]}>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.key}
            style={[
              styles.card,
              { backgroundColor: theme.cardBgColor, borderColor: theme.borderColor },
            ]}
            onPress={section.onPress}
            activeOpacity={0.82}>
            <View style={[styles.iconCircle, { backgroundColor: theme.tintColor + '22' }]}>
              <MaterialIcons name={section.icon} size={32} color={theme.tintColor} />
            </View>
            <View style={styles.cardText}>
              <ThemedText style={[styles.cardTitle, { color: theme.textColor }]}>
                {section.title}
              </ThemedText>
              <ThemedText style={[styles.cardDesc, { color: theme.mutedTextColor }]}>
                {section.description}
              </ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.mutedTextColor} />
          </TouchableOpacity>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 6, width: 36 },
  cards: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
    justifyContent: 'flex-start',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardDesc: { fontSize: 13, lineHeight: 18 },
});
