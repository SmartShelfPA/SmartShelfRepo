import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDue, formatLastActive, formatShortDate } from '@/src/lib/dates';
import type { AssignmentStatus, ChildStatus, ParentChild } from '@/src/types/parent';

const STATUS_META: Record<ChildStatus, { label: string; color: string }> = {
  on_track: { label: 'On track', color: '#2E7D32' },
  needs_attention: { label: 'Overdue work', color: '#e53935' },
  needs_review: { label: 'Needs support', color: '#d4a017' },
  inactive: { label: 'Quiet this week', color: '#687076' },
};

const ASSIGNMENT_STATUS: Record<AssignmentStatus, string> = {
  assigned: 'To do',
  submitted: 'Handed in',
  graded: 'Marked',
};

export function ChildProgressCard({
  child,
  onMessageTeacher,
}: {
  child: ParentChild;
  onMessageTeacher?: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const cardBg = isDark ? '#1F1F1F' : '#FFFFFF';
  const border = isDark ? '#2A2A2A' : '#E5E5E5';
  const muted = isDark ? '#9BA1A6' : '#687076';
  const subtle = isDark ? '#262626' : '#F5F5F5';
  const status = STATUS_META[child.status ?? 'inactive'];
  const practice = child.practice;
  const assignments = child.assignments ?? [];
  const reading = child.reading ?? [];
  const notes = child.teacherNotes ?? [];

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText style={styles.name}>{child.name}</ThemedText>
          <ThemedText style={{ color: muted, fontSize: 13 }}>
            {[child.className, child.schoolName].filter(Boolean).join(' · ') || 'Student'}
          </ThemedText>
        </View>
        <View style={[styles.pill, { borderColor: status.color }]}>
          <ThemedText style={[styles.pillText, { color: status.color }]}>{status.label}</ThemedText>
        </View>
      </View>
      <ThemedText style={{ color: muted, fontSize: 13 }}>
        Last active: {formatLastActive(child.lastActiveAt)}
      </ThemedText>

      <View style={styles.statsRow}>
        <Stat label="To do" value={String(child.currentTasks)} bg={subtle} />
        <Stat label="Done" value={String(child.completedTasks)} bg={subtle} />
        <Stat
          label="Practice avg"
          value={practice?.avgScorePercent != null ? `${Math.round(practice.avgScorePercent)}%` : '—'}
          bg={subtle}
        />
        <Stat label="Sessions (7d)" value={String(practice?.sessionsThisWeek ?? 0)} bg={subtle} />
      </View>

      <Section title="ASSIGNMENTS" muted={muted}>
        {assignments.length === 0 ? (
          <ThemedText style={{ color: muted }}>No assignments from teachers yet.</ThemedText>
        ) : (
          assignments.slice(0, 6).map((a) => (
            <View key={a.id} style={[styles.item, { borderColor: border }]}>
              <View style={styles.itemTop}>
                <ThemedText style={styles.itemTitle} numberOfLines={2}>
                  {a.title}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.itemStatus,
                    { color: a.isOverdue ? '#e53935' : a.status === 'graded' ? '#2E7D32' : muted },
                  ]}>
                  {a.isOverdue ? 'Overdue' : ASSIGNMENT_STATUS[a.status]}
                  {a.scorePercent != null ? ` · ${Math.round(a.scorePercent)}%` : ''}
                </ThemedText>
              </View>
              <ThemedText style={{ color: muted, fontSize: 12 }}>
                {a.teacherName ? `${a.teacherName} · ` : ''}
                {a.status === 'assigned' ? formatDue(a.dueAt) : `Handed in ${formatShortDate(a.submittedAt)}`}
              </ThemedText>
              {a.teacherFeedback ? (
                <ThemedText style={styles.feedback}>“{a.teacherFeedback}”</ThemedText>
              ) : null}
            </View>
          ))
        )}
      </Section>

      {practice && practice.recent.length > 0 ? (
        <Section title="RECENT PRACTICE" muted={muted}>
          {practice.recent.slice(0, 3).map((s) => (
            <View key={s.id} style={styles.lineRow}>
              <MaterialIcons name="edit-note" size={18} color={muted} />
              <ThemedText style={{ flex: 1 }} numberOfLines={1}>
                {s.examType} {s.subject}
                {s.year ? ` ${s.year}` : ''}
              </ThemedText>
              <ThemedText style={{ fontWeight: '700' }}>{Math.round(s.scorePercent)}%</ThemedText>
            </View>
          ))}
        </Section>
      ) : null}

      {reading.length > 0 ? (
        <Section title="READING" muted={muted}>
          {reading.slice(0, 3).map((r) => (
            <View key={r.id} style={{ gap: 4 }}>
              <View style={styles.lineRow}>
                <ThemedText style={{ flex: 1 }} numberOfLines={1}>
                  {r.title}
                </ThemedText>
                <ThemedText style={{ color: muted, fontSize: 12 }}>{Math.round(r.progressPercent)}%</ThemedText>
              </View>
              <View style={[styles.barTrack, { backgroundColor: subtle }]}>
                <View style={[styles.barFill, { width: `${Math.min(100, Math.max(2, r.progressPercent))}%` }]} />
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {notes.length > 0 ? (
        <Section title="NOTES FROM TEACHERS" muted={muted}>
          {notes.slice(0, 3).map((n) => (
            <View key={n.id} style={[styles.item, { borderColor: border }]}>
              <ThemedText>{n.note}</ThemedText>
              <ThemedText style={{ color: muted, fontSize: 12 }}>
                {n.teacherName} · {formatShortDate(n.createdAt)}
              </ThemedText>
            </View>
          ))}
        </Section>
      ) : null}

      {child.schoolName && onMessageTeacher ? (
        <TouchableOpacity
          style={[styles.messageBtn, { borderColor: border }]}
          onPress={onMessageTeacher}
          activeOpacity={0.8}
          accessibilityRole="button">
          <MaterialIcons name="chat-bubble-outline" size={18} color={isDark ? '#fff' : '#00C832'} />
          <ThemedText style={styles.messageBtnText}>Message {child.name.split(' ')[0]}&apos;s teacher</ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Stat({ label, value, bg }: { label: string; value: string; bg: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

function Section({ title, muted, children }: { title: string; muted: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <ThemedText style={[styles.sectionTitle, { color: muted }]}>{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 14, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 18, fontWeight: '700' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, opacity: 0.7, textAlign: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  item: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontWeight: '600' },
  itemStatus: { fontSize: 12, fontWeight: '700' },
  feedback: { fontStyle: 'italic', fontSize: 13 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#00C832' },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  messageBtnText: { fontWeight: '700', fontSize: 14 },
});
