import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { fetchSchoolResources, type SchoolResource } from '@/src/api/school';
import {
  createStaffTopic,
  deleteStaffTopic,
  fetchStaffTopics,
  type StaffTopic,
} from '@/src/api/study';
import { Button, Card, CenteredState, Chip, Field, Muted, Screen, SectionLabel } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';

type DraftQ = { prompt: string; a: string; b: string; correct: 'A' | 'B'; explanation: string; review: string; page: string };

function blankQuestion(): DraftQ {
  return { prompt: '', a: '', b: '', correct: 'A', explanation: '', review: '', page: '' };
}

function notify(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Chapter questions', message);
}

export default function StaffTopicsScreen() {
  const allowed = useRequireRole(['staff']);
  const [topics, setTopics] = useState<StaffTopic[] | null>(null);
  const [books, setBooks] = useState<SchoolResource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState('');
  const [pageStart, setPageStart] = useState('');
  const [questions, setQuestions] = useState<DraftQ[]>([blankQuestion()]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([fetchStaffTopics(), fetchSchoolResources()])
      .then(([nextTopics, nextBooks]) => {
        setTopics(nextTopics);
        setBooks(nextBooks);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load topics.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const save = async () => {
    if (!assetId) return notify('Choose the textbook this topic belongs to.');
    if (!title.trim()) return notify('Name the topic.');
    for (const [index, q] of questions.entries()) {
      if (!q.prompt.trim() || !q.a.trim() || !q.b.trim()) {
        return notify(`Question ${index + 1} needs text and two options.`);
      }
    }
    setSaving(true);
    try {
      await createStaffTopic({
        asset_id: assetId,
        title: title.trim(),
        chapter_label: chapter.trim(),
        page_start: pageStart ? Number(pageStart) : null,
        page_end: null,
        questions: questions.map((q) => ({
          prompt: q.prompt.trim(),
          options: [
            { id: 'A', label: q.a.trim() },
            { id: 'B', label: q.b.trim() },
          ],
          correct_option_id: q.correct,
          explanation: q.explanation.trim(),
          review_label: q.review.trim(),
          review_page: q.page ? Number(q.page) : pageStart ? Number(pageStart) : null,
        })),
      });
      setTitle('');
      setChapter('');
      setPageStart('');
      setQuestions([blankQuestion()]);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Chapter questions" subtitle="Quizzes mapped to a textbook section">
      <Card>
        <ThemedText style={styles.heading}>New topic</ThemedText>
        <Muted>Students who miss a question are sent back to the page you name.</Muted>
        <View style={styles.wrap}>
          {books.map((book) => (
            <Chip key={book.id} label={book.title} selected={assetId === book.id} onPress={() => setAssetId(book.id)} />
          ))}
        </View>
        {books.length === 0 ? <Muted>Upload a school textbook first.</Muted> : null}
        <Field label="Topic" value={title} onChangeText={setTitle} placeholder="e.g. The nucleus" />
        <Field label="Chapter" value={chapter} onChangeText={setChapter} placeholder="e.g. Chapter 2" />
        <Field label="Starts on page" value={pageStart} onChangeText={setPageStart} keyboardType="number-pad" />
        {questions.map((q, index) => (
          <View key={index} style={styles.question}>
            <SectionLabel>QUESTION {index + 1}</SectionLabel>
            <Field value={q.prompt} onChangeText={(v) => update(index, { prompt: v })} placeholder="Question" multiline />
            <Field label="A" value={q.a} onChangeText={(v) => update(index, { a: v })} />
            <Field label="B" value={q.b} onChangeText={(v) => update(index, { b: v })} />
            <View style={styles.wrap}>
              <Chip label="A is correct" selected={q.correct === 'A'} onPress={() => update(index, { correct: 'A' })} />
              <Chip label="B is correct" selected={q.correct === 'B'} onPress={() => update(index, { correct: 'B' })} />
            </View>
            <Field
              label="Explanation"
              value={q.explanation}
              onChangeText={(v) => update(index, { explanation: v })}
              placeholder="Shown after the student answers"
              multiline
            />
            <Field
              label="Section to review"
              value={q.review}
              onChangeText={(v) => update(index, { review: v })}
              placeholder="e.g. Section 2.1"
            />
            <Field label="Review page" value={q.page} onChangeText={(v) => update(index, { page: v })} keyboardType="number-pad" />
          </View>
        ))}
        <Button label="Add question" variant="secondary" onPress={() => setQuestions((prev) => [...prev, blankQuestion()])} />
        <Button label="Save topic" onPress={() => void save()} loading={saving} />
      </Card>

      {!allowed || (!topics && !error) ? (
        <CenteredState loading />
      ) : error ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : (
        topics?.map((topic) => (
          <Card key={topic.id}>
            <ThemedText style={styles.heading}>{topic.title}</ThemedText>
            <Muted>
              {topic.asset_title}
              {topic.chapter_label ? ` · ${topic.chapter_label}` : ''} · {topic.question_count} questions
            </Muted>
            <Button label="Delete" variant="danger" onPress={() => void deleteStaffTopic(topic.id).then(load)} />
          </Card>
        ))
      )}
    </Screen>
  );

  function update(index: number, patch: Partial<DraftQ>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  question: { gap: 8 },
});
