import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  ASSIGNMENT_KIND_LABELS,
  QUESTION_KIND_LABELS,
  SUBMISSION_STATUS_LABELS,
  deleteStaffAssignment,
  fetchAssignmentCsv,
  fetchStaffAssignment,
  type StaffAssignmentDetail,
  type SubmissionStatus,
} from '@/src/api/assignments';
import { Button, Card, CenteredState, Muted, Pill, Screen, SectionLabel, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { formatDue, formatShortDate } from '@/src/lib/dates';
import { saveCsv } from '@/src/lib/saveCsv';

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ])
  );
}

export default function StaffAssignmentDetailScreen() {
  const allowed = useRequireRole(['staff']);
  const router = useRouter();
  const t = useKitTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<StaffAssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const statusColor: Record<SubmissionStatus, string> = {
    assigned: t.muted,
    submitted: t.warning,
    graded: '#00C832',
  };

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    fetchStaffAssignment(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the assignment.'));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const exportCsv = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const { filename, csv } = await fetchAssignmentCsv(id);
      await saveCsv(filename, csv);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    if (!id || !data) return;
    const ok = await confirm('Delete assignment?', `"${data.title}" and all student work for it will be removed.`);
    if (!ok) return;
    try {
      await deleteStaffAssignment(id);
      router.back();
    } catch (e) {
      Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
    }
  };

  if (!allowed || (!data && !error)) {
    return (
      <Screen title="Assignment">
        <CenteredState loading />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen title="Assignment">
        <CenteredState message={error ?? 'Not found'} actionLabel="Retry" onAction={load} />
      </Screen>
    );
  }

  return (
    <Screen
      title={data.title}
      subtitle={`${ASSIGNMENT_KIND_LABELS[data.kind]} · ${data.target_class || 'Selected students'}`}
      right={
        <TouchableOpacity onPress={remove} accessibilityLabel="Delete assignment" style={{ padding: 6 }}>
          <MaterialIcons name="delete-outline" size={24} color={t.danger} />
        </TouchableOpacity>
      }>
      <Card>
        <Muted>{formatDue(data.due_at)}</Muted>
        {data.instructions ? <ThemedText>{data.instructions}</ThemedText> : null}
        {data.kind === 'practice' ? (
          <Muted>
            {data.exam_type} · {data.subject}
            {data.year ? ` · ${data.year} paper` : ''}
          </Muted>
        ) : null}
        {data.kind === 'reading' && data.resource ? (
          <Muted>
            Read: {data.resource.title}
            {data.resource_pages ? `, pages ${data.resource_pages}` : ''}
          </Muted>
        ) : null}
        <View style={styles.stats}>
          <Stat label="Submitted" value={`${data.submitted_count}/${data.total_students}`} />
          <Stat label="To mark" value={String(data.awaiting_marking_count)} />
          <Stat
            label="Average"
            value={data.avg_score_percent != null ? `${Math.round(data.avg_score_percent)}%` : '—'}
          />
        </View>
      </Card>

      <Button
        label="Export grades (CSV)"
        icon="file-download"
        variant="secondary"
        onPress={exportCsv}
        loading={exporting}
      />
      <Muted style={{ fontSize: 12 }}>
        The CSV opens in Excel or Google Sheets and can be imported into most school LMS gradebooks.
      </Muted>

      <SectionLabel>STUDENTS</SectionLabel>
      {data.submissions.map((s) => (
        <TouchableOpacity
          key={s.id}
          activeOpacity={0.8}
          disabled={s.status === 'assigned'}
          onPress={() => router.push({ pathname: '/staff/submissions/[id]', params: { id: s.id } })}>
          <Card style={styles.subRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText style={styles.name}>{s.student_name}</ThemedText>
              <Muted style={{ fontSize: 13 }}>
                {s.student_class}
                {s.submitted_at ? ` · submitted ${formatShortDate(s.submitted_at)}` : ''}
              </Muted>
            </View>
            {s.score_percent != null ? (
              <ThemedText style={styles.score}>{Math.round(s.score_percent)}%</ThemedText>
            ) : null}
            <Pill label={SUBMISSION_STATUS_LABELS[s.status]} color={statusColor[s.status]} />
            {s.status !== 'assigned' ? <MaterialIcons name="chevron-right" size={20} color={t.muted} /> : null}
          </Card>
        </TouchableOpacity>
      ))}

      {data.questions.length > 0 ? (
        <>
          <SectionLabel>QUESTIONS</SectionLabel>
          {data.questions.map((q, i) => (
            <Card key={q.id}>
              <Muted style={{ fontSize: 12 }}>
                {i + 1}. {QUESTION_KIND_LABELS[q.kind]} · {q.max_marks} mark{q.max_marks === 1 ? '' : 's'}
              </Muted>
              <ThemedText>{q.prompt}</ThemedText>
              {q.options.map((o) => (
                <Muted key={o.id} style={o.id === q.correct_option_id ? { color: '#00C832', fontWeight: '700' } : undefined}>
                  {o.id}. {o.label}
                  {o.id === q.correct_option_id ? '  ✓' : ''}
                </Muted>
              ))}
              {q.marking_guide ? <Muted>Guide: {q.marking_guide}</Muted> : null}
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700' },
  score: { fontSize: 15, fontWeight: '800' },
});
