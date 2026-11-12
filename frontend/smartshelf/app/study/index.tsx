import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { fetchStudyPlan, type StudyPlanItem } from '@/src/api/study';
import { Button, Card, CenteredState, Muted, Screen, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { formatDue } from '@/src/lib/dates';

const KIND_LABEL: Record<StudyPlanItem['kind'], string> = {
  assignment: 'Assignment',
  reading: 'Continue reading',
  practice: 'Topic practice',
  cards: 'Revision cards',
};

export default function StudyPlanScreen() {
  const allowed = useRequireRole(['student']);
  const router = useRouter();
  const t = useKitTheme();
  const [items, setItems] = useState<StudyPlanItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchStudyPlan()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your plan.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const open = (item: StudyPlanItem) => {
    if (item.kind === 'assignment') {
      router.push({ pathname: '/assignments/[id]', params: { id: item.id } });
    } else if (item.kind === 'practice') {
      router.push({ pathname: '/study/topic/[id]', params: { id: item.id } } as unknown as Href);
    } else if (item.kind === 'cards') {
      router.push('/study/cards' as Href);
    } else {
      router.push('/school/resources');
    }
  };

  return (
    <Screen title="This week" subtitle="Reading, practice, and cards in one list">
      {!allowed || (!items && !error) ? (
        <CenteredState loading />
      ) : error ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : items && items.length === 0 ? (
        <CenteredState message="Nothing queued this week. Open a school book or wait for your teacher to set work." />
      ) : (
        items?.map((item) => (
          <Card key={`${item.kind}-${item.id}`}>
            <View style={styles.row}>
              <MaterialIcons
                name={item.overdue ? 'warning' : 'event-note'}
                size={20}
                color={item.overdue ? t.danger : t.tint}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Muted style={{ fontSize: 12 }}>{KIND_LABEL[item.kind]}</Muted>
                <ThemedText style={styles.title}>{item.title}</ThemedText>
                <Muted>
                  {item.detail}
                  {item.due_at ? ` · ${formatDue(item.due_at)}` : ''}
                </Muted>
              </View>
            </View>
            <Button label="Open" variant="secondary" onPress={() => open(item)} />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: '700' },
});
