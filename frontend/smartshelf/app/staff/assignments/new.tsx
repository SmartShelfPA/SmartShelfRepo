import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  ASSIGNMENT_KIND_LABELS,
  QUESTION_KIND_LABELS,
  createAssignment,
  fetchRoster,
  type AssignmentKind,
  type QuestionDraft,
  type QuestionKind,
  type RosterClass,
} from '@/src/api/assignments';
import { plainTextFromPracticeHtml } from '@/src/api/explainAnswer';
import {
  ALOC_WAEC_JAMB_PRACTICE_SUBJECTS,
  fetchPastPaperQuestions,
  fetchPracticeYears,
} from '@/src/api/practice';
import { listProtectedPdfs, type ProtectedPdfAsset } from '@/src/api/protectedPdfs';
import { AssignmentPrompt } from '@/src/components/practice/AssignmentPrompt';
import { cleanDiagramUrl } from '@/src/components/practice/QuestionDiagram';
import { RichPrompt } from '@/src/components/practice/RichPrompt';
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
import type { NormalizedQuestion } from '@/src/types/practice';

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
const MAX_PICKS = 50;

type Exam = 'WAEC' | 'JAMB';

type PickedPastQuestion = {
  key: string;
  examType: Exam;
  subjectSlug: string;
  subjectLabel: string;
  year: number;
  question: NormalizedQuestion;
};

function clip(text: string, max: number): string {
  const value = text.trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function fieldText(html: string, max: number): string {
  const source = html.trim();
  if (source.length > 0 && source.length <= max) return source;
  return clip(plainTextFromPracticeHtml(source), max);
}

function subjectLabel(slug: string): string {
  return ALOC_WAEC_JAMB_PRACTICE_SUBJECTS.find((item) => item.alocSlug === slug)?.label ?? slug;
}

function pickKey(exam: Exam, subject: string, year: number, id: string): string {
  return `${exam}|${subject}|${year}|${id}`;
}

function paperYear(question: NormalizedQuestion, selectedYear: number): number {
  return question.year >= 1980 && question.year <= 2100 ? question.year : selectedYear;
}

function pastQuestionToDraft(item: PickedPastQuestion): QuestionDraft | null {
  const prompt = fieldText(item.question.promptHtml, 5000);
  if (!prompt) return null;
  const options = item.question.options
    .map((option) => ({
      id: option.id.slice(0, 16),
      label: fieldText(option.labelHtml, 1000),
    }))
    .filter((option) => option.label);
  const unique = options.filter((option, index) => options.findIndex((other) => other.id === option.id) === index);
  if (unique.length < 2) return null;
  const correctRaw = item.question.correctOptionId.slice(0, 16);
  const correct =
    unique.find((option) => option.id === correctRaw)?.id ??
    unique.find((option) => option.id.toLowerCase() === correctRaw.toLowerCase())?.id;
  if (!correct) return null;
  return {
    kind: 'mcq',
    prompt,
    options: unique,
    correct_option_id: correct,
    marking_guide: clip(plainTextFromPracticeHtml(item.question.explanationHtml ?? ''), 5000),
    review_label: clip(`${item.examType} ${item.subjectLabel} ${item.year}`, 200),
    diagram_url: cleanDiagramUrl(item.question.diagramUrl),
    max_marks: 1,
  };
}

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

  const [examType, setExamType] = useState<Exam>('WAEC');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [paper, setPaper] = useState<NormalizedQuestion[]>([]);
  const [paperLoading, setPaperLoading] = useState(false);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPastQuestion[]>([]);
  const paperRequest = useRef(0);

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
  }, [allowed]);

  useEffect(() => {
    if (!allowed || kind !== 'practice' || !subject) {
      setYears([]);
      return;
    }
    let cancelled = false;
    fetchPracticeYears(examType, subject)
      .then((list) => {
        if (cancelled) return;
        setYears(list);
        setYear((current) => (current != null && list.includes(current) ? current : (list[0] ?? null)));
      })
      .catch(() => {
        if (!cancelled) setYears([]);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, kind, examType, subject]);

  useEffect(() => {
    if (!allowed || kind !== 'practice' || !subject || year == null) {
      setPaper([]);
      setPaperLoading(false);
      setPaperError(null);
      return;
    }
    const requestId = ++paperRequest.current;
    setPaperLoading(true);
    setPaperError(null);
    fetchPastPaperQuestions({ examType, subject, year })
      .then((list) => {
        if (paperRequest.current !== requestId) return;
        setPaper(list);
      })
      .catch((error) => {
        if (paperRequest.current !== requestId) return;
        setPaper([]);
        setPaperError(error instanceof Error ? error.message : 'Could not load this paper.');
      })
      .finally(() => {
        if (paperRequest.current === requestId) setPaperLoading(false);
      });
  }, [allowed, kind, examType, subject, year]);

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

  const togglePastQuestion = (question: NormalizedQuestion) => {
    if (!subject || year == null) return;
    const chosenYear = paperYear(question, year);
    const key = pickKey(examType, subject, chosenYear, question.id);
    setPicked((prev) => {
      if (prev.some((item) => item.key === key)) return prev.filter((item) => item.key !== key);
      if (prev.length >= MAX_PICKS) {
        fail(`An assignment can include at most ${MAX_PICKS} questions.`);
        return prev;
      }
      return [
        ...prev,
        {
          key,
          examType,
          subjectSlug: subject,
          subjectLabel: subjectLabel(subject),
          year: chosenYear,
          question,
        },
      ];
    });
  };

  const pickedGroups = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const item of picked) {
      const label = `${item.examType} ${item.subjectLabel} ${item.year}`;
      const current = map.get(label);
      if (current) current.count += 1;
      else map.set(label, { label, count: 1 });
    }
    return [...map.values()];
  }, [picked]);

  const pickedKeys = useMemo(() => new Set(picked.map((item) => item.key)), [picked]);

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
    if (kind === 'practice' && picked.length > 0) {
      const drafts = picked.map(pastQuestionToDraft);
      const unusable = drafts.findIndex((draft) => draft == null);
      if (unusable >= 0) {
        return fail(`Question ${unusable + 1} in your selection could not be copied. Remove it and try again.`);
      }
      const selected = drafts.filter((draft): draft is QuestionDraft => draft != null);
      const sameExam = new Set(picked.map((item) => item.examType)).size === 1;
      const sameSubject = new Set(picked.map((item) => item.subjectSlug)).size === 1;
      const sameYear = new Set(picked.map((item) => item.year)).size === 1;
      setSaving(true);
      try {
        const created = await createAssignment({
          title: title.trim(),
          kind: 'questions',
          instructions: instructions.trim(),
          target_class: pickStudents ? '' : targetClass,
          student_ids: pickStudents ? studentIds : [],
          due_at: due,
          exam_type: sameExam ? picked[0].examType : '',
          subject: sameSubject ? picked[0].subjectSlug : '',
          year: sameYear ? picked[0].year : null,
          question_count: selected.length,
          questions: selected,
        });
        router.replace({ pathname: '/staff/assignments/[id]', params: { id: created.id } });
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Could not create the assignment.');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (kind === 'practice' && !subject) return fail('Pick a subject, or tick questions from a paper.');
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
            ? 'Tick questions from any papers below. Change the exam, subject, or year and the ones you already ticked stay in this assignment.'
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
          <SectionLabel>PICK QUESTIONS</SectionLabel>
          <Muted>
            Open one paper, tick the questions you want, then open another paper and tick more. A Maths
            question from 2011 and one from 2013 can sit together, and so can Physics, English, or any
            other paper.
          </Muted>
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
          <ThemedText style={styles.fieldLabel}>Paper year</ThemedText>
          {!subject ? (
            <Muted>Choose a subject to see the years that paper has.</Muted>
          ) : years.length === 0 ? (
            <Muted>Loading years…</Muted>
          ) : (
            <View style={styles.wrap}>
              {years.map((y) => (
                <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
              ))}
            </View>
          )}

          {pickedGroups.length > 0 ? (
            <Card>
              <ThemedText style={styles.qTitle}>In this assignment · {picked.length}</ThemedText>
              <Muted>These stay selected when you open another paper.</Muted>
              {pickedGroups.map((group) => (
                <View key={group.label} style={styles.pickedRow}>
                  <ThemedText style={styles.flex}>
                    {group.label} · {group.count} question{group.count === 1 ? '' : 's'}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() =>
                      setPicked((prev) =>
                        prev.filter((item) => `${item.examType} ${item.subjectLabel} ${item.year}` !== group.label)
                      )
                    }
                    accessibilityLabel={`Remove ${group.label}`}>
                    <ThemedText style={{ color: t.danger, fontWeight: '700' }}>Remove</ThemedText>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          ) : null}

          {!subject || year == null ? null : paperLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={t.accent} />
              <Muted>
                Loading {examType} {subjectLabel(subject)} {year}…
              </Muted>
            </View>
          ) : paperError ? (
            <Card>
              <ThemedText style={styles.qTitle}>Could not load this paper</ThemedText>
              <Muted>{paperError}</Muted>
            </Card>
          ) : (
            <>
              <ThemedText style={styles.qTitle}>
                {examType} · {subjectLabel(subject)} · {year}
              </ThemedText>
              <Muted>
                {paper.length} question{paper.length === 1 ? '' : 's'}. Tick the ones that belong in this
                assignment.
              </Muted>
              {paper.map((question, index) => {
                const key = pickKey(examType, subject, paperYear(question, year), question.id);
                const selected = pickedKeys.has(key);
                return (
                  <Card key={key} style={selected ? { borderColor: t.accent } : undefined}>
                    <TouchableOpacity
                      style={styles.qHeader}
                      onPress={() => togglePastQuestion(question)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}>
                      <MaterialIcons
                        name={selected ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={selected ? t.tint : t.muted}
                      />
                      <ThemedText style={styles.qTitle}>Question {index + 1}</ThemedText>
                      <Muted style={{ marginLeft: 'auto' }}>{selected ? 'Selected' : 'Tap to select'}</Muted>
                    </TouchableOpacity>
                    <AssignmentPrompt
                      prompt={question.promptHtml}
                      diagramUrl={question.diagramUrl}
                      color={t.text}
                      textStyle={styles.prompt}
                    />
                    {question.options.map((option) => (
                      <View key={option.id} style={[styles.option, { borderColor: t.border }]}>
                        <ThemedText style={{ fontWeight: '700' }}>{option.id}</ThemedText>
                        <View style={styles.flex}>
                          <RichPrompt value={option.labelHtml} color={t.text} />
                        </View>
                      </View>
                    ))}
                  </Card>
                );
              })}
            </>
          )}
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

      <Button
        label={
          kind === 'practice' && picked.length > 0
            ? `Create assignment · ${picked.length} question${picked.length === 1 ? '' : 's'}`
            : 'Create assignment'
        }
        icon="send"
        onPress={save}
        loading={saving}
        style={{ marginTop: 12 }}
      />
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
  flex: { flex: 1 },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  prompt: { fontSize: 15, lineHeight: 22 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 8, padding: 8 },
});
