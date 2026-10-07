import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  ASSIGNMENT_KIND_LABELS,
  QUESTION_KIND_LABELS,
  SUBMISSION_STATUS_LABELS,
  fetchStudentAssignment,
  submitStudentAssignment,
  type StudentAssignment,
} from '@/src/api/assignments';
import { ALOC_WAEC_JAMB_PRACTICE_SUBJECTS, fetchPracticeYears } from '@/src/api/practice';
import { getProtectedPdf, type ProtectedPdfAsset } from '@/src/api/protectedPdfs';
import { ProtectedResourceItem } from '@/src/components/igcse/ProtectedResourceItem';
import { Button, Card, CenteredState, Field, Muted, Screen, SectionLabel, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { formatDue, formatShortDate } from '@/src/lib/dates';

type Draft = Record<string, { selected?: string; text?: string }>;

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function askConfirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Submit', onPress: () => resolve(true) },
    ])
  );
}

export default function StudentAssignmentScreen() {
  const allowed = useRequireRole(['student']);
  const router = useRouter();
  const t = useKitTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<StudentAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [reflection, setReflection] = useState('');
  const [resource, setResource] = useState<ProtectedPdfAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    fetchStudentAssignment(id)
      .then((d) => {
        setData(d);
        setReflection(d.submission.response_text ?? '');
        const next: Draft = {};
        for (const a of d.submission.answers ?? []) {
          next[a.question_id] = { selected: a.selected_option_id, text: a.text_answer };
        }
        setDraft(next);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the assignment.'));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  useEffect(() => {
    const resourceId = data?.resource?.id;
    if (!resourceId) return;
    getProtectedPdf(resourceId).then(setResource).catch(() => setResource(null));
  }, [data?.resource?.id]);

  const startPractice = async () => {
    if (!data) return;
    const exam = (data.exam_type || 'WAEC').toLowerCase();
    const subject = ALOC_WAEC_JAMB_PRACTICE_SUBJECTS.find((s) => s.alocSlug === data.subject);
    const year = data.year ?? (await fetchPracticeYears('WAEC'))[0] ?? new Date().getFullYear();
    router.push({
      pathname: '/practice/[examType]/session',
      params: {
        examType: exam,
        subject: data.subject,
        subjectLabel: subject?.label ?? data.subject,
        year: String(year),
        assignmentId: data.id,
      },
    });
  };

  const submit = async () => {
    if (!data || !id) return;
    if (data.kind === 'questions') {
      const questions = data.questions ?? [];
      const missing = questions.filter((q) =>
        q.kind === 'mcq' ? !draft[q.id]?.selected : !(draft[q.id]?.text ?? '').trim()
      ).length;
      const ok = await askConfirm(
        'Hand in your answers?',
        missing > 0
          ? `You have ${missing} unanswered question${missing === 1 ? '' : 's'}. You can't change answers after your teacher marks them.`
          : "You can't change answers after your teacher marks them."
      );
      if (!ok) return;
    } else if (data.kind === 'reading' && !reflection.trim()) {
      notify('Add a reflection', 'Write a few sentences about what you read before handing in.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await submitStudentAssignment(
        id,
        data.kind === 'questions'
          ? {
              answers: (data.questions ?? []).map((q) => ({
                question_id: q.id,
                selected_option_id: draft[q.id]?.selected ?? '',
                text_answer: draft[q.id]?.text ?? '',
              })),
            }
          : { response_text: reflection.trim() }
      );
      setData(updated);
      notify(
        'Handed in',
        updated.submission.status === 'graded'
          ? `Your score: ${Math.round(updated.submission.score_percent ?? 0)}%`
          : 'Your teacher will mark it soon.'
      );
    } catch (e) {
      notify('Could not submit', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSubmitting(false);
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

  const sub = data.submission;
  const graded = sub.status === 'graded';
  const editable = !graded && data.kind !== 'practice';
  const answersById = new Map((sub.answers ?? []).map((a) => [a.question_id, a]));

  return (
    <Screen title={data.title} subtitle={`${ASSIGNMENT_KIND_LABELS[data.kind]} · ${data.teacher_name}`}>
      <Card>
        <View style={styles.row}>
          <Muted style={{ flex: 1 }}>{formatDue(data.due_at)}</Muted>
          <ThemedText style={{ fontWeight: '700' }}>{SUBMISSION_STATUS_LABELS[sub.status]}</ThemedText>
        </View>
        {data.instructions ? <ThemedText>{data.instructions}</ThemedText> : null}
        {graded && sub.score_percent != null ? (
          <ThemedText style={styles.score}>{Math.round(sub.score_percent)}%</ThemedText>
        ) : null}
        {sub.teacher_feedback ? (
          <View style={[styles.feedback, { borderColor: t.accent }]}>
            <Muted style={{ fontSize: 12 }}>Teacher feedback</Muted>
            <ThemedText>{sub.teacher_feedback}</ThemedText>
          </View>
        ) : null}
        {sub.submitted_at ? <Muted style={{ fontSize: 12 }}>Handed in {formatShortDate(sub.submitted_at)}</Muted> : null}
      </Card>

      {data.kind === 'practice' ? (
        <Card>
          <ThemedText style={styles.prompt}>
            {data.exam_type} past questions · {ALOC_WAEC_JAMB_PRACTICE_SUBJECTS.find((s) => s.alocSlug === data.subject)?.label ?? data.subject}
            {data.year ? ` · ${data.year}` : ''}
          </ThemedText>
          <Muted>
            Finish a practice session and your score is sent to your teacher automatically.
            {graded ? ' You can do it again to improve your score.' : ''}
          </Muted>
          <Button label={graded ? 'Practise again' : 'Start practice'} icon="play-arrow" onPress={startPractice} />
        </Card>
      ) : null}

      {data.kind === 'reading' ? (
        <>
          {data.resource ? (
            <>
              <SectionLabel>
                READ{data.resource_pages ? ` · PAGES ${data.resource_pages}` : ''}
              </SectionLabel>
              {resource ? <ProtectedResourceItem asset={resource} /> : <Muted>{data.resource.title}</Muted>}
            </>
          ) : null}
          <Field
            label="Your reflection"
            value={reflection}
            onChangeText={setReflection}
            editable={editable}
            placeholder="What did you learn? What was difficult?"
            multiline
          />
        </>
      ) : null}

      {data.kind === 'questions'
        ? (data.questions ?? []).map((q, i) => {
            const answer = answersById.get(q.id);
            const selected = draft[q.id]?.selected;
            return (
              <Card key={q.id}>
                <Muted style={{ fontSize: 12 }}>
                  Question {i + 1} · {QUESTION_KIND_LABELS[q.kind]} · {q.max_marks} mark{q.max_marks === 1 ? '' : 's'}
                  {graded && answer?.awarded_marks != null ? ` · you got ${answer.awarded_marks}` : ''}
                </Muted>
                <ThemedText style={styles.prompt}>{q.prompt}</ThemedText>
                {q.kind === 'mcq' ? (
                  q.options.map((o) => {
                    const isSelected = selected === o.id;
                    const isCorrect = graded && q.correct_option_id === o.id;
                    const isWrong = graded && isSelected && !isCorrect;
                    return (
                      <TouchableOpacity
                        key={o.id}
                        disabled={!editable}
                        onPress={() => setDraft((prev) => ({ ...prev, [q.id]: { ...prev[q.id], selected: o.id } }))}
                        style={[
                          styles.option,
                          { borderColor: isCorrect ? '#00C832' : isWrong ? t.danger : isSelected ? t.accent : t.border },
                        ]}>
                        <MaterialIcons
                          name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                          size={20}
                          color={isSelected ? t.tint : t.muted}
                        />
                        <ThemedText style={{ flex: 1 }}>
                          {o.id}. {o.label}
                        </ThemedText>
                        {isCorrect ? <MaterialIcons name="check" size={18} color="#00C832" /> : null}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Field
                    value={draft[q.id]?.text ?? ''}
                    onChangeText={(v) => setDraft((prev) => ({ ...prev, [q.id]: { ...prev[q.id], text: v } }))}
                    editable={editable}
                    placeholder={q.kind === 'theory' ? 'Write your full answer and working' : 'Your answer'}
                    multiline
                  />
                )}
                {graded && q.marking_guide ? <Muted>Model answer: {q.marking_guide}</Muted> : null}
                {answer?.feedback ? <Muted>Teacher: {answer.feedback}</Muted> : null}
              </Card>
            );
          })
        : null}

      {editable ? (
        <Button
          label={sub.status === 'submitted' ? 'Update and hand in again' : 'Hand in'}
          icon="send"
          onPress={submit}
          loading={submitting}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  score: { fontSize: 28, fontWeight: '800' },
  prompt: { fontSize: 15, fontWeight: '600' },
  feedback: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
});
