import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import {
  ASSIGNMENT_KIND_LABELS,
  SUBMISSION_STATUS_LABELS,
  fetchStudentAssignments,
  type StudentAssignment,
} from '@/src/api/assignments';
import { Card, CenteredState, Muted, Pill, Screen, SectionLabel, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { formatDue } from '@/src/lib/dates';

export default function StudentAssignmentsScreen() {
  const allowed = useRequireRole(['student']);
  const router = useRouter();
  const t = useKitTheme();
  const [items, setItems] = useState<StudentAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchStudentAssignments()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load assignments.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const { todo, done } = useMemo(() => {
    const list = items ?? [];
    return {
      todo: list.filter((a) => a.submission.status === 'assigned'),
      done: list.filter((a) => a.submission.status !== 'assigned'),
    };
  }, [items]);

  const statusColor = { assigned: t.warning, submitted: t.muted, graded: '#00C832' } as const;

  const renderItem = (a: StudentAssignment) => {
    const overdue = a.submission.status === 'assigned' && !!a.due_at && new Date(a.due_at) < new Date();
    return (
      <TouchableOpacity
        key={a.id}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/assignments/[id]', params: { id: a.id } })}>
        <Card>
          <View style={styles.row}>
            <ThemedText style={[styles.title, { flex: 1 }]} numberOfLines={2}>
              {a.title}
            </ThemedText>
            <Pill
              label={
                a.submission.status === 'graded' && a.submission.score_percent != null
                  ? `${Math.round(a.submission.score_percent)}%`
                  : SUBMISSION_STATUS_LABELS[a.submission.status]
              }
              color={statusColor[a.submission.status]}
            />
          </View>
          <Muted>
            {ASSIGNMENT_KIND_LABELS[a.kind]}
            {a.teacher_name ? ` · ${a.teacher_name}` : ''}
          </Muted>
          <Muted style={overdue ? { color: t.danger, fontWeight: '600' } : undefined}>{formatDue(a.due_at)}</Muted>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <Screen title="Assignments" subtitle="Work set by your teachers">
      {!allowed || (!items && !error) ? (
        <CenteredState loading />
      ) : error ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : items && items.length === 0 ? (
        <CenteredState message="No assignments yet. When your teacher sets work, it will show up here." />
      ) : (
        <>
          <SectionLabel>TO DO · {todo.length}</SectionLabel>
          {todo.length === 0 ? <Muted>You are all caught up.</Muted> : todo.map(renderItem)}
          {done.length > 0 ? (
            <>
              <SectionLabel>HANDED IN · {done.length}</SectionLabel>
              {done.map(renderItem)}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
});
