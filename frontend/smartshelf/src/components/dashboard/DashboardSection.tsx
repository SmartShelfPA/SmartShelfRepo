import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { DashboardData } from '@/src/types/dashboard';

type Props = {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function DashboardSection({ data, isLoading, error, onRetry }: Props) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  return (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
        DASHBOARD
      </ThemedText>

      {isLoading ? (
        <ThemedText style={{ color: mutedTextColor, paddingHorizontal: 16 }}>Loading insights…</ThemedText>
      ) : error ? (
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <ThemedText style={{ color: mutedTextColor }}>{error}</ThemedText>
          <TouchableOpacity onPress={onRetry} activeOpacity={0.85}>
            <ThemedText style={{ color: tintColor, fontWeight: '800' }}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      ) : !data ? (
        <ThemedText style={{ color: mutedTextColor, paddingHorizontal: 16 }}>No dashboard data.</ThemedText>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.cardTitle, { color: mutedTextColor }]}>Current IGCSE book</ThemedText>
            {data.currentIgcsBook ? (
              <>
                <ThemedText style={[styles.cardMain, { color: textColor }]} numberOfLines={2}>
                  {data.currentIgcsBook.title}
                </ThemedText>
                <ThemedText style={{ color: mutedTextColor, fontSize: 12 }}>
                  {data.currentIgcsBook.subject}
                  {typeof data.currentIgcsBook.progressPercent === 'number'
                    ? ` · ${Math.round(data.currentIgcsBook.progressPercent)}% read`
                    : ''}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => router.push('/igcse-coming-soon' as Href)}
                  activeOpacity={0.85}
                  style={styles.inlineLink}>
                  <ThemedText style={{ color: tintColor, fontWeight: '900' }}>Open IGCSE shelf</ThemedText>
                  <MaterialIcons name="chevron-right" size={18} color={tintColor} />
                </TouchableOpacity>
              </>
            ) : (
              <ThemedText style={{ color: mutedTextColor }}>No active EPUB selected yet.</ThemedText>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.cardTitle, { color: mutedTextColor }]}>Reading progress</ThemedText>
            {data.books.length === 0 ? (
              <ThemedText style={{ color: mutedTextColor }}>No books tracked yet.</ThemedText>
            ) : (
              data.books.slice(0, 4).map((row, index) => (
                <View key={row.book.id || `book-row-${index}`} style={styles.progressRow}>
                  <ThemedText style={{ color: textColor, flex: 1 }} numberOfLines={1}>
                    {row.book.title}
                  </ThemedText>
                  <ThemedText style={{ color: tintColor, fontWeight: '900' }}>
                    {Math.round(row.progressPercent)}%
                  </ThemedText>
                </View>
              ))
            )}
          </View>

          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.cardTitle, { color: mutedTextColor }]}>Practice sessions</ThemedText>
            <View style={styles.kpis}>
              <View style={styles.kpi}>
                <ThemedText style={{ color: mutedTextColor, fontSize: 12 }}>Completed</ThemedText>
                <ThemedText style={{ color: textColor, fontSize: 18, fontWeight: '900' }}>
                  {data.completedSessions}
                </ThemedText>
              </View>
              <View style={styles.kpi}>
                <ThemedText style={{ color: mutedTextColor, fontSize: 12 }}>In progress</ThemedText>
                <ThemedText style={{ color: textColor, fontSize: 18, fontWeight: '900' }}>
                  {data.inProgressSessions}
                </ThemedText>
              </View>
              <View style={styles.kpi}>
                <ThemedText style={{ color: mutedTextColor, fontSize: 12 }}>Last activity</ThemedText>
                <ThemedText style={{ color: textColor, fontSize: 12, fontWeight: '700' }} numberOfLines={2}>
                  {data.lastActivityAt ? new Date(data.lastActivityAt).toLocaleString() : '—'}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.cardTitle, { color: mutedTextColor }]}>Average scores</ThemedText>
            {data.averagesByExam?.length ? (
              data.averagesByExam.map((row, index) => (
                <View key={`${row.examType}-${index}`} style={styles.avgRow}>
                  <ThemedText style={{ color: textColor, fontWeight: '800' }}>{row.examType}</ThemedText>
                  <ThemedText style={{ color: tintColor, fontWeight: '900' }}>
                    {Math.round(row.averagePercent)}% ({row.sessionCount} sessions)
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText style={{ color: mutedTextColor }}>No scored sessions yet.</ThemedText>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.cardTitle, { color: mutedTextColor }]}>Recent sessions</ThemedText>
            {data.recentSessions.length === 0 ? (
              <ThemedText style={{ color: mutedTextColor }}>No recent sessions.</ThemedText>
            ) : (
              data.recentSessions.slice(0, 6).map((s, index) => (
                <View key={s.id || `session-${index}`} style={styles.sessionRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ color: textColor, fontWeight: '800' }} numberOfLines={1}>
                      {s.examType} · {s.subject}
                    </ThemedText>
                    <ThemedText style={{ color: mutedTextColor, fontSize: 12 }} numberOfLines={1}>
                      {new Date(s.startedAt).toLocaleString()} · {Math.round(s.scorePercent)}%
                    </ThemedText>
                  </View>
                  <ThemedText style={{ color: tintColor, fontWeight: '900' }}>{s.status}</ThemedText>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 10,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardMain: {
    fontSize: 16,
    fontWeight: '900',
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  kpis: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  kpi: {
    flex: 1,
    minWidth: '30%',
    gap: 4,
  },
  avgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000022',
  },
});
