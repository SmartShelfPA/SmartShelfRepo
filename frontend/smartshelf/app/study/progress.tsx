import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { fetchProgress, type ProgressReport, type TopicStatus } from '@/src/api/study';
import { Card, CenteredState, Muted, Screen, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';

const STATUS_LABEL: Record<TopicStatus, string> = {
  mastered: 'Practised successfully',
  retry: 'Needs another attempt',
  new: 'Not practised yet',
};

export default function ProgressScreen() {
  const allowed = useRequireRole(['student']);
  const router = useRouter();
  const t = useKitTheme();
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchProgress()
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load progress.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const topics = report?.understanding.topics ?? [];

  return (
    <Screen title="Learning progress" subtitle="Activity and understanding are kept apart">
      {!allowed || (!report && !error) ? (
        <CenteredState loading />
      ) : error ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : report ? (
        <>
          <Card>
            <ThemedText style={styles.heading}>Reading activity</ThemedText>
            <ThemedText style={styles.stat}>{report.reading_activity.books_opened_this_week}</ThemedText>
            <Muted>School books opened in the last 7 days.</Muted>
            <Muted>{report.reading_activity.note}</Muted>
          </Card>
          <Card>
            <ThemedText style={styles.heading}>Understanding</ThemedText>
            <Muted>
              A topic counts as practised successfully at {report.understanding.mastery_percent}% or higher.
            </Muted>
            {topics.length === 0 ? (
              <Muted>Your teachers have not added chapter questions yet.</Muted>
            ) : (
              topics.map((topic) => (
                <TouchableOpacity
                  key={topic.id}
                  style={[styles.topic, { borderColor: t.border }]}
                  onPress={() => router.push({ pathname: '/study/topic/[id]', params: { id: topic.id } } as unknown as Href)}>
                  <ThemedText style={styles.topicTitle}>{topic.title}</ThemedText>
                  <Muted>
                    {[topic.subject, topic.chapter_label].filter(Boolean).join(' · ')}
                  </Muted>
                  <ThemedText style={{ color: topic.status === 'retry' ? t.warning : t.tint, fontWeight: '700' }}>
                    {STATUS_LABEL[topic.status]}
                    {topic.score_percent != null ? ` · ${Math.round(topic.score_percent)}%` : ''}
                  </ThemedText>
                </TouchableOpacity>
              ))
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '700' },
  stat: { fontSize: 32, fontWeight: '800' },
  topic: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 2 },
  topicTitle: { fontWeight: '700' },
});
