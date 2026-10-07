import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import {
  QUESTION_KIND_LABELS,
  SUBMISSION_STATUS_LABELS,
  fetchStaffSubmission,
  gradeSubmission,
  type StaffSubmissionDetail,
} from '@/src/api/assignments';
import { Button, Card, CenteredState, Field, Muted, Screen, SectionLabel, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { formatShortDate } from '@/src/lib/dates';

type MarkDraft = { marks: string; feedback: string };

export default function MarkSubmissionScreen() {
  const allowed = useRequireRole(['staff']);
  const router = useRouter();
  const t = useKitTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<StaffSubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, MarkDraft>>({});
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    fetchStaffSubmission(id)
      .then((d) => {
        setData(d);
        setFeedback(d.teacher_feedback ?? '');
        const next: Record<string, MarkDraft> = {};
        for (const a of d.answers) {
          next[a.id] = {
            marks: a.awarded_marks != null ? String(a.awarded_marks) : '',
            feedback: a.feedback ?? '',
          };
        }
        setMarks(next);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the submission.'));
  }, [id]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const save = async () => {
    if (!id || !data) return;
    const answers = data.answers.map((a) => {
      const draft = marks[a.id];
      const parsed = draft?.marks.trim() ? Number(draft.marks) : null;
      return {
        answer_id: a.id,
        awarded_marks: parsed != null && Number.isFinite(parsed) ? parsed : null,
        feedback: draft?.feedback ?? '',
      };
    });
    const unmarked = data.questions.some((q) => {
      if (q.kind === 'mcq') return false;
      const a = data.answers.find((x) => x.question_id === q.id);
      return !!a && !(marks[a.id]?.marks ?? '').trim();
    });
    if (unmarked) {
      const msg = 'Some written answers have no marks yet. They will count as 0.';
      const proceed =
        Platform.OS === 'web'
          ? window.confirm(msg)
          : await new Promise<boolean>((resolve) =>
              Alert.alert('Save marks?', msg, [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Save', onPress: () => resolve(true) },
              ])
            );
      if (!proceed) return;
    }
    setSaving(true);
    try {
      await gradeSubmission(id, { answers, teacher_feedback: feedback.trim() });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed || (!data && !error)) {
    return (
      <Screen title="Mark work">
        <CenteredState loading />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen title="Mark work">
        <CenteredState message={error ?? 'Not found'} actionLabel="Retry" onAction={load} />
      </Screen>
    );
  }

  const kind = data.assignment.kind;

  return (
    <Screen
      title={data.student_name}
      subtitle={`${data.assignment.title} · ${SUBMISSION_STATUS_LABELS[data.status]}`}>
      <Card>
        <Muted>
          {data.student_class}
          {data.submitted_at ? ` · submitted ${formatShortDate(data.submitted_at)}` : ''}
        </Muted>
        {data.score_percent != null ? (
          <ThemedText style={styles.score}>
            {Math.round(data.score_percent)}%
            {data.awarded_marks != null && kind === 'questions'
              ? `  (${data.awarded_marks} marks)`
              : ''}
          </ThemedText>
        ) : null}
      </Card>

      {kind === 'practice' ? (
        <Card>
          <ThemedText>
            Practice sessions are scored automatically. You can still leave the student a comment.
          </ThemedText>
        </Card>
      ) : null}

      {kind === 'reading' ? (
        <Card>
          <SectionLabel>STUDENT&apos;S REFLECTION</SectionLabel>
          <ThemedText>{data.response_text || '(No text written)'}</ThemedText>
        </Card>
      ) : null}

      {kind === 'questions'
        ? data.questions.map((q, i) => {
            const answer = data.answers.find((a) => a.question_id === q.id);
            const draft = answer ? marks[answer.id] : undefined;
            const chosen = q.options.find((o) => o.id === answer?.selected_option_id);
            return (
              <Card key={q.id}>
                <Muted style={{ fontSize: 12 }}>
                  {i + 1}. {QUESTION_KIND_LABELS[q.kind]} · out of {q.max_marks}
                </Muted>
                <ThemedText style={styles.prompt}>{q.prompt}</ThemedText>
                {q.kind === 'mcq' ? (
                  <ThemedText
                    style={{ color: answer?.is_correct ? '#00C832' : t.danger, fontWeight: '600' }}>
                    {chosen ? `${chosen.id}. ${chosen.label}` : 'No answer'}
                    {answer?.is_correct ? '  ✓ correct' : ` ✗ (answer: ${q.correct_option_id})`}
                  </ThemedText>
                ) : (
                  <View style={[styles.answerBox, { borderColor: t.border }]}>
                    <ThemedText>{answer?.text_answer || '(No answer)'}</ThemedText>
                  </View>
                )}
                {q.marking_guide ? <Muted>Guide: {q.marking_guide}</Muted> : null}
                {answer ? (
                  <View style={styles.markRow}>
                    <View style={{ width: 100 }}>
                      <Field
                        label="Marks"
                        value={draft?.marks ?? ''}
                        keyboardType="decimal-pad"
                        onChangeText={(v) =>
                          setMarks((prev) => ({
                            ...prev,
                            [answer.id]: { marks: v.replace(/[^0-9.]/g, ''), feedback: prev[answer.id]?.feedback ?? '' },
                          }))
                        }
                        placeholder={`/${q.max_marks}`}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Comment"
                        value={draft?.feedback ?? ''}
                        onChangeText={(v) =>
                          setMarks((prev) => ({
                            ...prev,
                            [answer.id]: { marks: prev[answer.id]?.marks ?? '', feedback: v },
                          }))
                        }
                        placeholder="Optional"
                      />
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          })
        : null}

      <Field
        label="Overall feedback for the student"
        value={feedback}
        onChangeText={setFeedback}
        placeholder="e.g. Good method, watch your signs in question 3."
        multiline
        hint="Parents linked to this student also see your feedback."
      />
      <Button
        label={data.status === 'graded' ? 'Update marks' : 'Save marks'}
        icon="check"
        onPress={save}
        loading={saving}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: 22, fontWeight: '800' },
  prompt: { fontSize: 15, fontWeight: '600' },
  answerBox: { borderWidth: 1, borderRadius: 8, padding: 10 },
  markRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
