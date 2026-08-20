import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { resumeNowReading, useNowReadingStore } from '@/src/store/nowReading';

export function NowReadingBar() {
  const router = useRouter();
  const current = useNowReadingStore((s) => s.current);

  if (!current) {
    return (
      <View style={styles.bar}>
        <MaterialIcons name="menu-book" size={20} color="#9a9a9a" />
        <ThemedText style={styles.empty}>Pick a textbook to start a Now Reading session</ThemedText>
      </View>
    );
  }

  const pct = Math.round(current.progressPercent || 0);

  return (
    <View style={styles.bar}>
      <View style={styles.cover}>
        <MaterialIcons name="menu-book" size={22} color="#00FF41" />
      </View>
      <View style={styles.meta}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {current.title}
        </ThemedText>
        <ThemedText style={styles.sub} numberOfLines={1}>
          {current.subtitle || (current.kind === 'pdf' ? 'PDF' : 'EPUB')} · {pct}%
        </ThemedText>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
      <TouchableOpacity
        style={styles.resume}
        onPress={() => void resumeNowReading(router)}
        activeOpacity={0.85}>
        <MaterialIcons name="play-arrow" size={22} color="#111" />
        <ThemedText style={styles.resumeText}>Resume  ⌘R</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: '#161616',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 4 },
  title: { color: '#fff', fontSize: 14, fontWeight: '800' },
  sub: { color: '#9a9a9a', fontSize: 12 },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#2f2f2f',
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: { height: '100%', backgroundColor: '#00FF41' },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00FF41',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resumeText: { color: '#111', fontWeight: '800', fontSize: 13 },
  empty: { color: '#8d8d8d', fontSize: 13, flex: 1 },
});
