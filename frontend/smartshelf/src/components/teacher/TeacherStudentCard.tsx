import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { StudentStatus, TeacherStudent } from '@/src/api/teacher';

const STATUS_CONFIG: Record<
  StudentStatus,
  { label: string; bg: string; fg: string }
> = {
  on_track: { label: 'On track', bg: 'rgba(0,255,65,0.15)', fg: '#1a8f3a' },
  falling_behind: { label: 'Falling behind', bg: 'rgba(255,165,0,0.15)', fg: '#b36b00' },
  inactive: { label: 'Inactive', bg: 'rgba(150,150,150,0.15)', fg: '#666' },
  needs_review: { label: 'Needs review', bg: 'rgba(255,68,68,0.12)', fg: '#cc3333' },
};

function formatLastActive(iso: string | null): string {
  if (!iso) return 'No activity yet';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (24 * 3600 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function TeacherStudentCard({ student }: { student: TeacherStudent }) {
  const colorScheme = useColorScheme();
  const cardBg = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const border = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const muted = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const badge = STATUS_CONFIG[student.status];

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.name}>{student.name}</ThemedText>
          <ThemedText style={[styles.meta, { color: muted }]}>{student.className}</ThemedText>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <ThemedText style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</ThemedText>
        </View>
      </View>
      <View style={styles.grid}>
        <Cell label="Last active" value={formatLastActive(student.lastActiveAt)} />
        <Cell label="Books opened" value={String(student.booksOpened)} />
        <Cell label="Chapters read" value={String(student.chaptersRead)} />
        <Cell label="Reading time" value={`${student.readingMinutes} min`} />
        <Cell
          label="Quiz avg"
          value={student.avgQuizScore != null ? `${student.avgQuizScore}%` : '—'}
        />
        <Cell label="Assignments" value={String(student.assignmentsSubmitted)} />
      </View>
      {(student.strengths.length > 0 || student.weaknesses.length > 0) && (
        <View style={styles.subjects}>
          {student.strengths.length > 0 ? (
            <ThemedText style={[styles.subjectLine, { color: muted }]}>
              Strengths: {student.strengths.join(', ')}
            </ThemedText>
          ) : null}
          {student.weaknesses.length > 0 ? (
            <ThemedText style={[styles.subjectLine, { color: muted }]}>
              Needs work: {student.weaknesses.join(', ')}
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <ThemedText style={styles.cellValue}>{value}</ThemedText>
      <ThemedText style={styles.cellLabel}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 12, marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '30%', minWidth: 90, gap: 2 },
  cellValue: { fontSize: 14, fontWeight: '600' },
  cellLabel: { fontSize: 10, opacity: 0.65 },
  subjects: { gap: 4 },
  subjectLine: { fontSize: 12 },
});
