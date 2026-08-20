import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { resumeNowReading, useNowReadingStore } from '@/src/store/nowReading';
import type { DashboardData } from '@/src/types/dashboard';

type Props = {
  dashboard: DashboardData | null;
};

export function ContinueReadingSection({ dashboard }: Props) {
  const router = useRouter();
  const current = useNowReadingStore((s) => s.current);
  const recent = useNowReadingStore((s) => s.recent);

  const fallback = dashboard?.currentIgcsBook
    ? {
        title: dashboard.currentIgcsBook.title,
        subtitle: dashboard.currentIgcsBook.subject,
        progressPercent: dashboard.currentIgcsBook.progressPercent ?? 0,
      }
    : null;

  const hero = current
    ? {
        title: current.title,
        subtitle: current.subtitle,
        progressPercent: current.progressPercent,
      }
    : fallback;

  const recents = recent.filter((item) => item.bookId !== current?.bookId).slice(0, 6);

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.heading}>Continue Reading</ThemedText>
      {hero ? (
        <TouchableOpacity
          style={styles.hero}
          onPress={() => {
            if (current) {
              void resumeNowReading(router);
              return;
            }
            router.push('/igcse' as Href);
          }}
          activeOpacity={0.85}>
          <ThemedText style={styles.heroTitle} numberOfLines={2}>
            {hero.title}
          </ThemedText>
          <ThemedText style={styles.heroSub} numberOfLines={1}>
            {hero.subtitle || 'Textbook'} · {Math.round(hero.progressPercent)}%
          </ThemedText>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(hero.progressPercent)}%` }]} />
          </View>
        </TouchableOpacity>
      ) : (
        <ThemedText style={styles.empty}>Open a textbook to resume it here.</ThemedText>
      )}

      {recents.length > 0 ? (
        <>
          <ThemedText style={[styles.heading, { marginTop: 18 }]}>Recently opened</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {recents.map((item) => (
              <TouchableOpacity
                key={item.bookId}
                style={styles.card}
                onPress={() => {
                  useNowReadingStore.getState().setSession(item);
                  void resumeNowReading(router);
                }}
                activeOpacity={0.85}>
                <ThemedText style={styles.cardTitle} numberOfLines={3}>
                  {item.title}
                </ThemedText>
                <ThemedText style={styles.cardSub}>{Math.round(item.progressPercent)}%</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 8, paddingHorizontal: 16, gap: 10 },
  heading: { fontSize: 18, fontWeight: '700' },
  hero: {
    backgroundColor: '#1b1b1b',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
    gap: 6,
  },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroSub: { color: '#9a9a9a', fontSize: 13 },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#2f2f2f',
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: { height: '100%', backgroundColor: '#00FF41' },
  empty: { color: '#8d8d8d', fontSize: 13 },
  row: { gap: 10, paddingRight: 8 },
  card: {
    width: 160,
    minHeight: 110,
    backgroundColor: '#1b1b1b',
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
    justifyContent: 'space-between',
  },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cardSub: { color: '#00FF41', fontWeight: '800', marginTop: 10 },
});
