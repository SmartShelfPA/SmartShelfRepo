import { useCallback, useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import {
  ASSIGNMENT_KIND_LABELS,
  fetchStaffAssignments,
  type StaffAssignmentSummary,
} from '@/src/api/assignments';
import { Button, Card, CenteredState, Muted, Pill, Screen, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { formatDue } from '@/src/lib/dates';

export default function StaffAssignmentsScreen() {
  const allowed = useRequireRole(['staff']);
  const router = useRouter();
  const t = useKitTheme();
  const [items, setItems] = useState<StaffAssignmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchStaffAssignments()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load assignments.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  return (
    <Screen title="Assignments" subtitle="Practice, reading and your own questions">
      <Button label="New assignment" icon="add" onPress={() => router.push('/staff/assignments/new')} />

      {!allowed || (!items && !error) ? (
        <CenteredState loading />
      ) : error ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : items && items.length === 0 ? (
        <Card>
          <ThemedText style={styles.title}>No assignments yet</ThemedText>
          <Muted>
            Set WAEC/JAMB past-question practice, a reading from your school resources, or write your own
            multiple-choice and theory questions.
          </Muted>
        </Card>
      ) : (
        items?.map((a) => (
          <TouchableOpacity
            key={a.id}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/staff/assignments/[id]', params: { id: a.id } })}>
            <Card>
              <View style={styles.row}>
                <ThemedText style={[styles.title, { flex: 1 }]} numberOfLines={2}>
                  {a.title}
                </ThemedText>
                {a.awaiting_marking_count > 0 ? (
                  <Pill label={`${a.awaiting_marking_count} to mark`} color={t.warning} />
                ) : null}
              </View>
              <Muted>
                {ASSIGNMENT_KIND_LABELS[a.kind]} · {a.target_class || 'Selected students'} · {formatDue(a.due_at)}
              </Muted>
              <Muted>
                Submitted {a.submitted_count}/{a.total_students} · Marked {a.graded_count}
                {a.avg_score_percent != null ? ` · Average ${Math.round(a.avg_score_percent)}%` : ''}
              </Muted>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
});
