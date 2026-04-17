import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SamplePapersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const accentColor = '#00FF41'; // SmartShelf green
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const openPdf = (n: 1 | 2 | 3 | 4) => {
    const base = 'https://cdsu15footballcup.com/SampleMathematicsQuestion';
    const pdfUrl = `${base}${n}.pdf`;
    router.push({ pathname: '/pdf-viewer', params: { uri: pdfUrl } });
  };

  const handleOpenPdf = (n: 1 | 2 | 3 | 4) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openPdf(n);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]} type="defaultSemiBold">
          CDSU15 Sample Math Papers
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>
        <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
          Tap a paper to open in the viewer
        </ThemedText>

        {([1, 2, 3, 4] as const).map((n) => {
          const label = `Sample Mathematics Question ${n}`;
          return (
            <TouchableOpacity
              key={n}
              style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}
              onPress={() => handleOpenPdf(n)}
              activeOpacity={0.8}
              accessibilityLabel={label}
              accessibilityRole="button">
              <View style={[styles.cardIcon, { backgroundColor: `${accentColor}20` }]}>
                <MaterialIcons name="picture-as-pdf" size={28} color={accentColor} />
              </View>
              <View style={styles.cardContent}>
                <ThemedText style={[styles.cardTitle, { color: textColor }]} numberOfLines={2}>
                  {label}
                </ThemedText>
                <ThemedText style={[styles.cardSubtitle, { color: mutedTextColor }]} numberOfLines={1}>
                  Question {n}
                </ThemedText>
              </View>
              <View style={[styles.cardChevron, { backgroundColor: `${accentColor}30` }]}>
                <MaterialIcons name="chevron-right" size={24} color={accentColor} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 17,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 24,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
  },
  cardChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
