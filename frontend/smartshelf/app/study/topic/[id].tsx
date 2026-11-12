import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  fetchTopic,
  submitTopicAttempt,
  type TopicAttemptResult,
  type TopicQuestionPublic,
} from '@/src/api/study';
import { Button, Card, CenteredState, Muted, Screen, useKitTheme } from '@/src/components/ui/kit';
import { prepareProtectedOpen } from '@/src/lib/protectedPdfAccess';
import { useRequireRole } from '@/src/hooks/useRequireRole';

export default function TopicQuizScreen() {
  const allowed = useRequireRole(['student']);
  const router = useRouter();
  const t = useKitTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState('');
  const [questions, setQuestions] = useState<TopicQuestionPublic[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TopicAttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    setResult(null);
    fetchTopic(id)
      .then((topic) => {
        setTitle(topic.title);
        setChapter(topic.chapter_label);
        setQuestions(topic.questions);
        setPicks({});
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this quiz.'));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const submit = async () => {
    if (!id || !questions) return;
    if (questions.some((q) => !picks[q.id])) {
      setError('Answer every question before handing it in.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      setResult(
        await submitTopicAttempt(
          id,
          questions.map((q) => ({ question_id: q.id, selected_option_id: picks[q.id] }))
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  };

  const openSection = async (page: number | null) => {
    if (!result) return;
    const opened = await prepareProtectedOpen(result.asset.id);
    if (opened.ok) {
      router.push({
        pathname: '/igcse/pdf-reader',
        params: {
          localUri: opened.localUri,
          bookId: result.asset.id,
          title: result.asset.title,
          page: String(page || 1),
        },
      });
      return;
    }
    router.push('/school/resources');
  };

  return (
    <Screen title={title || 'Topic quiz'} subtitle={chapter || 'Linked to your textbook'}>
      {!allowed || (!questions && !error) ? (
        <CenteredState loading />
      ) : error && !questions ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : result ? (
        <>
          <Card>
            <ThemedText style={styles.score}>{Math.round(result.score_percent)}%</ThemedText>
            <Muted>
              {result.correct_count} of {result.total_count} correct.
              {result.status === 'mastered'
                ? ' Practised successfully.'
                : ` Below ${result.mastery_percent}% — needs another attempt.`}
            </Muted>
            <Button
              label="Save a revision card"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/study/cards',
                  params: {
                    assetId: result.asset.id,
                    title: result.asset.title,
                    page: String(result.questions.find((q) => q.review_page)?.review_page ?? 1),
                  },
                } as unknown as Href)
              }
            />
          </Card>
          {result.questions.map((q, index) => (
            <Card key={q.id}>
              <Muted>Question {index + 1}</Muted>
              <ThemedText style={styles.prompt}>{q.prompt}</ThemedText>
              <ThemedText style={{ color: q.is_correct ? '#00C832' : t.danger, fontWeight: '700' }}>
                {q.is_correct ? 'Correct' : 'Not quite'}
              </ThemedText>
              {q.explanation ? <Muted>{q.explanation}</Muted> : null}
              {!q.is_correct ? (
                <TouchableOpacity
                  onPress={() => void openSection(q.review_page)}
                  style={styles.review}>
                  <MaterialIcons name="menu-book" size={18} color={t.tint} />
                  <ThemedText style={{ color: t.tint, fontWeight: '700', flex: 1 }}>
                    Review this section{q.review_label ? `: ${q.review_label}` : ''}
                    {q.review_page ? ` · page ${q.review_page}` : ''}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </Card>
          ))}
          <Button label="Try again" onPress={load} />
        </>
      ) : (
        <>
          {questions?.map((q, index) => (
            <Card key={q.id}>
              <Muted>Question {index + 1}</Muted>
              <ThemedText style={styles.prompt}>{q.prompt}</ThemedText>
              {q.options.map((option) => {
                const selected = picks[q.id] === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => setPicks((prev) => ({ ...prev, [q.id]: option.id }))}
                    style={[styles.option, { borderColor: selected ? t.accent : t.border }]}>
                    <MaterialIcons
                      name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={selected ? t.tint : t.muted}
                    />
                    <ThemedText style={{ flex: 1 }}>
                      {option.id}. {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </Card>
          ))}
          {error ? <Muted style={{ color: t.danger }}>{error}</Muted> : null}
          <Button label="Hand in" onPress={() => void submit()} loading={submitting} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: 36, fontWeight: '800' },
  prompt: { fontSize: 16, fontWeight: '700' },
  option: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10 },
  review: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
