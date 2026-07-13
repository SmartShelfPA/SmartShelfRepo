import React from 'react';
import { View, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TeacherClassOverview } from '@/src/api/teacher';

export function TeacherClassOverviewCard({ cls }: { cls: TeacherClassOverview }) {
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const muted = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const border = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const tint = colorScheme === 'dark' ? '#fff' : '#00FF41';

  const stats = [
    { label: 'Students', value: cls.totalStudents },
    { label: 'Active this week', value: cls.activeThisWeek },
    { label: 'Avg study (min)', value: cls.avgStudyMinutes },
    { label: 'Completion %', value: `${cls.avgCompletionRate}%` },
  ];

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.header}>
        <MaterialIcons name="class" size={22} color={tint} />
        <ThemedText style={[styles.className, { color: textColor }]}>{cls.name}</ThemedText>
      </View>
      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: textColor }]}>{s.value}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: muted }]}>{s.label}</ThemedText>
          </View>
        ))}
      </View>
      <ThemedText style={[styles.weakLabel, { color: muted }]}>Top weak topics</ThemedText>
      <View style={styles.tags}>
        {cls.topWeakTopics.map((t) => (
          <View key={t} style={[styles.tag, { backgroundColor: border }]}>
            <ThemedText style={styles.tagText}>{t}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  className: { fontSize: 17, fontWeight: '700' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { minWidth: '45%', flex: 1, gap: 2 },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11 },
  weakLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12, fontWeight: '600' },
});
