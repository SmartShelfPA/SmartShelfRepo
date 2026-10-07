import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  ASSIGNMENT_KIND_LABELS,
  QUESTION_KIND_LABELS,
  createAssignment,
  fetchRoster,
  type AssignmentKind,
  type QuestionKind,
  type RosterClass,
} from '@/src/api/assignments';
import { ALOC_WAEC_JAMB_PRACTICE_SUBJECTS, fetchPracticeYears } from '@/src/api/practice';
import { listProtectedPdfs, type ProtectedPdfAsset } from '@/src/api/protectedPdfs';
import {
  Button,
  Card,
  CenteredState,
  Chip,
  Field,
  Muted,
  Screen,
  SectionLabel,
  useKitTheme,
} from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';

type DraftOption = { id: string; label: string };
type DraftQuestion = {
  key: string;
  kind: QuestionKind;
  prompt: string;
  options: DraftOption[];
  correct: string;
  guide: string;
  marks: string;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function newQuestion(kind: QuestionKind = 'mcq'): DraftQuestion {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    prompt: '',
    options: LETTERS.slice(0, 4).map((id) => ({ id, label: '' })),
    correct: 'A',
    guide: '',
    marks: kind === 'theory' ? '5' : '1',
  };
}

/** Accepts YYYY-MM-DD; due at the end of that day, local time. */
function parseDueDate(value: string): string | null | 'invalid' {
  const v = value.trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return 'invalid';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0);
  if (Number.isNaN(d.getTime())) return 'invalid';
  return d.toISOString();
}

export default function NewAssignmentScreen() {
  const allowed = useRequireRole(['staff']);
  const router = useRouter();
  const t = useKitTheme();

  const [roster, setRoster] = useState<RosterClass[] | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [resources, setResources] = useState<ProtectedPdfAsset[]>([]);
  const [years, setYears] = useState<number[]>([]);

  const [kind, setKind] = useState<AssignmentKind>('questions');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [pickStudents, setPickStudents] = useState(false);
  const [studentIds, setStudentIds] = useState<string[]>([]);

  const [examType, setExamType] = useState<'WAEC' | 'JAMB'>('WAEC');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState<number | null>(null);

  const [resourceId, setResourceId] = useState<string | null>(null);
  const [pages, setPages] = useState('');

  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion('mcq')]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    fetchRoster()
      .then((classes) => {
        setRoster(classes);
        if (classes.length === 1) setTargetClass(classes[0].name);
      })
      .catch((e) => setRosterError(e instanceof Error ? e.message : 'Could not load your classes.'));
    listProtectedPdfs().then(setResources).catch(() => setResources([]));
    fetchPracticeYears('WAEC').then(setYears).catch(() => setYears([]));
  }, [allowed]);

  const allStudents = useMemo(
    () => (roster ?? []).flatMap((c) => c.students.map((s) => ({ ...s, className: c.name }))),
    [roster]
  );

  const totalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0),
    [questions]
  );

  const updateQuestion = (key: string, patch: Partial<DraftQuestion>) =>
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const toggleStudent = (id: string) =>
    setStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const fail = (message: string) => {
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert('Check the assignment', message);
  };

  const save = async () => {
    if (!title.trim()) return fail('Give the assignment a title.');
    if (pickStudents ? studentIds.length === 0 : !targetClass) {
      return fail('Choose a class or at least one student.');
    }
    const due = parseDueDate(dueDate);
    if (due === 'invalid') return fail('Write the due date as YYYY-MM-DD, e.g. 2026-10-20.');
    if (kind === 'practice' && !subject) return fail('Pick a subject for the practice.');
    if (kind === 'reading' && !resourceId && !instructions.trim()) {
      return fail('Pick a resource or describe what students should read.');
    }
    if (kind === 'questions') {
      for (const [i, q] of questions.entries()) {
        if (!q.prompt.trim()) return fail(`Question ${i + 1} has no text.`);
        if (q.kind === 'mcq') {
          const filled = q.options.filter((o) => o.label.trim());
          if (filled.length < 2) return fail(`Question ${i + 1} needs at least two options.`);
          if (!filled.some((o) => o.id === q.correct)) {
            return fail(`Pick the correct option for question ${i + 1}.`);
          }
        }
      }
    }

    setSaving(true);
    try {
      const created = await createAssignment({
        title: title.trim(),
        kind,
        instructions: instructions.trim(),
        target_class: pickStudents ? '' : targetClass,
        student_ids: pickStudents ? studentIds : [],
        due_at: due,
        ...(kind === 'practice' ? { exam_type: examType, subject, year } : {}),
        ...(kind === 'reading' ? { resource_id: resourceId, resource_pages: pages.trim() } : {}),
        ...(kind === 'questions'
          ? {
              questions: questions.map((q) => ({
                kind: q.kind,
                prompt: q.prompt.trim(),
                options: q.kind === 'mcq' ? q.options.filter((o) => o.label.trim()) : [],
                correct_option_id: q.kind === 'mcq' ? q.correct : '',
                marking_guide: q.guide.trim(),
                max_marks: Math.max(1, Math.min(100, Number(q.marks) || 1)),
              })),
            }
          : {}),
      });
      router.replace({ pathname: '/staff/assignments/[id]', params: { id: created.id } });
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Could not create the assignment.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed || (!roster && !rosterError)) {
    return (
      <Screen title="New assignment">
        <CenteredState loading />
      </Screen>
    );
  }

  if (rosterError) {
    return (
      <Screen title="New assignment">
        <CenteredState message={rosterError} />
      </Screen>
    );
  }

  return (
    <Screen title="New assignment" subtitle="Students see it on their home screen">
      <SectionLabel>TYPE</SectionLabel>
      <View style={styles.wrap}>
        {(['questions', 'practice', 'reading'] as AssignmentKind[]).map((k) => (
          <Chip key={k} label={ASSIGNMENT_KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <Muted>
        {kind === 'questions'
          ? 'Write your own questions. Multiple choice is marked automatically; short and theory answers come to you to mark.'
          : kind === 'practice'
            ? 'Students do a WAEC/JAMB past-question session. Their score comes back to you automatically.'
            : 'Students read a resource (e.g. pages from a school PDF) and write a short reflection for you.'}
      </Muted>

      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Quadratic equations check" />
      <Field
        label="Instructions (optional)"
        value={instructions}
        onChangeText={setInstructions}
        placeholder="What should students do?"
        multiline
      />
      <Field
        label="Due date (optional)"
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        hint="Due at the end of that day."
      />

      <SectionLabel>WHO IS IT FOR?</SectionLabel>
      {roster && roster.length === 0 ? (
        <Muted>No students in your school yet. A school admin can add student accounts.</Muted>
      ) : (
        <>
          <View style={styles.switchRow}>
            <ThemedText style={{ flex: 1 }}>Pick individual students</ThemedText>
            <Switch value={pickStudents} onValueChange={setPickStudents} trackColor={{ true: t.accent }} />
          </View>
          {pickStudents ? (
            <View style={styles.wrap}>
              {allStudents.map((s) => (
                <Chip
                  key={s.id}
                  label={`${s.name} (${s.className})`}
                  selected={studentIds.includes(s.id)}
                  onPress={() => toggleStudent(s.id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.wrap}>
              {roster?.map((c) => (
                <Chip
                  key={c.name}
                  label={`${c.name} · ${c.students.length}`}
                  selected={targetClass === c.name}
                  onPress={() => setTargetClass(c.name)}
                />
              ))}
            </View>
          )}
        </>
      )}

      {kind === 'practice' ? (
        <>
          <SectionLabel>PRACTICE</SectionLabel>
          <View style={styles.wrap}>
            {(['WAEC', 'JAMB'] as const).map((e) => (
              <Chip key={e} label={e} selected={examType === e} onPress={() => setExamType(e)} />
            ))}
          </View>
          <ThemedText style={styles.fieldLabel}>Subject</ThemedText>
          <View style={styles.wrap}>
            {ALOC_WAEC_JAMB_PRACTICE_SUBJECTS.map((s) => (
              <Chip
                key={s.alocSlug}
                label={s.label}
                selected={subject === s.alocSlug}
                onPress={() => setSubject(s.alocSlug)}
              />
            ))}
          </View>
          <ThemedText style={styles.fieldLabel}>Paper year (optional)</ThemedText>
          <View style={styles.wrap}>
            <Chip label="Any" selected={year === null} onPress={() => setYear(null)} />
            {years.map((y) => (
              <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
            ))}
          </View>
        </>
      ) : null}

      {kind === 'reading' ? (
        <>
          <SectionLabel>WHAT TO READ</SectionLabel>
          {resources.length === 0 ? (
            <Muted>
              No PDFs available yet. Upload one under School resources, or describe the reading in the
              instructions.
            </Muted>
          ) : (
            <View style={styles.wrap}>
              <Chip label="None" selected={resourceId === null} onPress={() => setResourceId(null)} />
              {resources.map((r) => (
                <Chip key={r.id} label={r.title} selected={resourceId === r.id} onPress={() => setResourceId(r.id)} />
              ))}
            </View>
          )}
          <Field label="Pages (optional)" value={pages} onChangeText={setPages} placeholder="e.g. 12-18" />
        </>
      ) : null}

      {kind === 'questions' ? (
        <>
          <SectionLabel>QUESTIONS · {totalMarks} MARKS</SectionLabel>
          {questions.map((q, i) => (
            <Card key={q.key}>
              <View style={styles.qHeader}>
                <ThemedText style={styles.qTitle}>Question {i + 1}</ThemedText>
                {questions.length > 1 ? (
                  <TouchableOpacity
                    onPress={() => setQuestions((prev) => prev.filter((x) => x.key !== q.key))}
                    accessibilityLabel={`Remove question ${i + 1}`}>
                    <MaterialIcons name="delete-outline" size={22} color={t.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.wrap}>
                {(['mcq', 'short', 'theory'] as QuestionKind[]).map((k) => (
                  <Chip
                    key={k}
                    label={QUESTION_KIND_LABELS[k]}
                    selected={q.kind === k}
                    onPress={() => updateQuestion(q.key, { kind: k, marks: k === 'theory' ? '5' : q.marks })}
                  />
                ))}
              </View>
              <Field
                value={q.prompt}
                onChangeText={(v) => updateQuestion(q.key, { prompt: v })}
                placeholder={
                  q.kind === 'theory'
                    ? 'e.g. Explain three causes of inflation in Nigeria.'
                    : 'Question text'
                }
                multiline
              />
              {q.kind === 'mcq' ? (
                <>
                  {q.options.map((o) => (
                    <View key={o.id} style={styles.optionRow}>
                      <TouchableOpacity
                        onPress={() => updateQuestion(q.key, { correct: o.id })}
                        accessibilityLabel={`Mark option ${o.id} correct`}>
                        <MaterialIcons
                          name={q.correct === o.id ? 'radio-button-checked' : 'radio-button-unchecked'}
                          size={22}
                          color={q.correct === o.id ? t.tint : t.muted}
                        />
                      </TouchableOpacity>
                      <ThemedText style={styles.optionLetter}>{o.id}</ThemedText>
                      <View style={{ flex: 1 }}>
                        <Field
                          value={o.label}
                          onChangeText={(v) =>
                            updateQuestion(q.key, {
                              options: q.options.map((x) => (x.id === o.id ? { ...x, label: v } : x)),
                            })
                          }
                          placeholder={`Option ${o.id}`}
                        />
                      </View>
                    </View>
                  ))}
                  <Muted>Tap the circle next to the correct answer.</Muted>
                  {q.options.length < LETTERS.length ? (
                    <TouchableOpacity
                      onPress={() =>
                        updateQuestion(q.key, {
                          options: [...q.options, { id: LETTERS[q.options.length], label: '' }],
                        })
                      }>
                      <ThemedText style={{ color: t.tint, fontWeight: '600' }}>+ Add option</ThemedText>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <Field
                  label="Marking guide (only you see this until marked)"
                  value={q.guide}
                  onChangeText={(v) => updateQuestion(q.key, { guide: v })}
                  placeholder="Key points or model answer"
                  multiline
                />
              )}
              <Field
                label="Marks"
                value={q.marks}
                onChangeText={(v) => updateQuestion(q.key, { marks: v.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                style={{ width: 90 }}
              />
            </Card>
          ))}
          <View style={styles.addRow}>
            <Button
              label="Multiple choice"
              icon="add"
              variant="secondary"
              onPress={() => setQuestions((prev) => [...prev, newQuestion('mcq')])}
              style={{ flex: 1 }}
            />
            <Button
              label="Written"
              icon="add"
              variant="secondary"
              onPress={() => setQuestions((prev) => [...prev, newQuestion('theory')])}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : null}

      <Button label="Create assignment" icon="send" onPress={save} loading={saving} style={{ marginTop: 12 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600' },
  qHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qTitle: { fontSize: 16, fontWeight: '700' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionLetter: { width: 18, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 10 },
});
