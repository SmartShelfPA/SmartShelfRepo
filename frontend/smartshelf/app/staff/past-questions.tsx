import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  createAssignment,
  fetchRoster,
  type QuestionDraft,
  type RosterClass,
} from '@/src/api/assignments';
import { plainTextFromPracticeHtml } from '@/src/api/explainAnswer';
import {
  ALOC_WAEC_JAMB_PRACTICE_SUBJECTS,
  fetchPastPaperQuestions,
  fetchPracticeYears,
  type PracticeSubjectOption,
} from '@/src/api/practice';
import { AssignmentPrompt } from '@/src/components/practice/AssignmentPrompt';
import { cleanDiagramUrl } from '@/src/components/practice/QuestionDiagram';
import { RichPrompt } from '@/src/components/practice/RichPrompt';
import {
  Button,
  Card,
  Chip,
  Field,
  Muted,
  Screen,
  SectionLabel,
  useKitTheme,
} from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import type { NormalizedQuestion } from '@/src/types/practice';

const MAX_PICKS = 50;

type Exam = 'WAEC' | 'JAMB';

type PickedQuestion = {
  key: string;
  examType: Exam;
  subjectSlug: string;
  subjectLabel: string;
  year: number;
  question: NormalizedQuestion;
};

function fail(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Check the assignment', message);
}

function clip(text: string, max: number): string {
  const value = text.trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Keep HTML when it fits the API limit so diagrams survive; otherwise store readable text. */
function fieldText(html: string, max: number): string {
  const source = html.trim();
  if (source.length > 0 && source.length <= max) return source;
  return clip(plainTextFromPracticeHtml(source), max);
}

function pickKey(exam: Exam, subject: string, year: number, id: string): string {
  return `${exam}|${subject}|${year}|${id}`;
}

function toDraft(item: PickedQuestion): QuestionDraft | null {
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
  const source = `${item.examType} ${item.subjectLabel} ${item.year}`;
  return {
    kind: 'mcq',
    prompt,
    options: unique,
    correct_option_id: correct,
    marking_guide: clip(plainTextFromPracticeHtml(item.question.explanationHtml ?? ''), 5000),
    review_label: clip(source, 200),
    diagram_url: cleanDiagramUrl(item.question.diagramUrl),
    max_marks: 1,
  };
}

function paperYear(question: NormalizedQuestion, selectedYear: number): number {
  return question.year >= 1980 && question.year <= 2100 ? question.year : selectedYear;
}

function suggestedTitle(items: PickedQuestion[]): string {
  if (items.length === 0) return 'Past questions';
  const exam = new Set(items.map((item) => item.examType)).size === 1 ? items[0].examType : 'WAEC and JAMB';
  const subject =
    new Set(items.map((item) => item.subjectLabel)).size === 1 ? items[0].subjectLabel : 'mixed subjects';
  const year = new Set(items.map((item) => item.year)).size === 1 ? ` ${items[0].year}` : '';
  return clip(`${exam} ${subject}${year}`, 200);
}

/** Accepts YYYY-MM-DD; due at the end of that day, local time. */
function parseDueDate(value: string): string | null | 'invalid' {
  const v = value.trim();
  if (!v) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!match) return 'invalid';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 0);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return date.toISOString();
}

export default function PastQuestionsScreen() {
  const allowed = useRequireRole(['staff']);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useKitTheme();

  const [examType, setExamType] = useState<Exam>('WAEC');
  const [subjectQuery, setSubjectQuery] = useState('');
  const [subject, setSubject] = useState<PracticeSubjectOption | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);

  const [paper, setPaper] = useState<NormalizedQuestion[]>([]);
  const [paperLoading, setPaperLoading] = useState(false);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [questionQuery, setQuestionQuery] = useState('');
  const [showAnswers, setShowAnswers] = useState(true);
  const [picked, setPicked] = useState<PickedQuestion[]>([]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [roster, setRoster] = useState<RosterClass[] | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState(
    'Answer these past questions. Your score is marked automatically.'
  );
  const [dueDate, setDueDate] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [pickStudents, setPickStudents] = useState(false);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!allowed) return;
    if (!subject) {
      setYears([]);
      return;
    }
    let cancelled = false;
    fetchPracticeYears(examType, subject.alocSlug)
      .then((list) => {
        if (cancelled) return;
        setYears(list);
        setYear((current) => (current != null && list.includes(current) ? current : list[0] ?? null));
      })
      .catch(() => {
        if (!cancelled) setYears([]);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, examType, subject]);

  useEffect(() => {
    if (!allowed) return;
    fetchRoster()
      .then((classes) => {
        setRoster(classes);
        if (classes.length === 1) setTargetClass(classes[0].name);
      })
      .catch(() => setRoster([]));
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !subject || year == null) return;
    const id = ++requestId.current;
    setPaperLoading(true);
    setPaperError(null);
    setQuestionQuery('');
    fetchPastPaperQuestions({ examType, subject: subject.alocSlug, year })
      .then((questions) => {
        if (id !== requestId.current) return;
        setPaper(questions);
      })
      .catch((error) => {
        if (id !== requestId.current) return;
        setPaper([]);
        setPaperError(error instanceof Error ? error.message : 'Could not load this paper.');
      })
      .finally(() => {
        if (id === requestId.current) setPaperLoading(false);
      });
  }, [allowed, examType, subject, year, reloadToken]);

  const subjects = useMemo(() => {
    const query = subjectQuery.trim().toLowerCase();
    if (!query) return ALOC_WAEC_JAMB_PRACTICE_SUBJECTS;
    return ALOC_WAEC_JAMB_PRACTICE_SUBJECTS.filter(
      (item) => item.label.toLowerCase().includes(query) || item.alocSlug.includes(query)
    );
  }, [subjectQuery]);

  const visible = useMemo(() => {
    const query = questionQuery.trim().toLowerCase();
    if (!query) return paper;
    return paper.filter((question) => {
      const haystack = [
        plainTextFromPracticeHtml(question.promptHtml),
        ...question.options.map((option) => plainTextFromPracticeHtml(option.labelHtml)),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [paper, questionQuery]);

  const allStudents = useMemo(
    () => (roster ?? []).flatMap((item) => item.students.map((student) => ({ ...student, className: item.name }))),
    [roster]
  );

  const pickedKeys = useMemo(() => new Set(picked.map((item) => item.key)), [picked]);

  const toggleQuestion = (question: NormalizedQuestion) => {
    if (!subject || year == null) return;
    const chosenYear = paperYear(question, year);
    const key = pickKey(examType, subject.alocSlug, chosenYear, question.id);
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
          subjectSlug: subject.alocSlug,
          subjectLabel: subject.label,
          year: chosenYear,
          question,
        },
      ];
    });
  };

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const item of picked) {
      const label = `${item.examType} ${item.subjectLabel} ${item.year}`;
      const current = map.get(label);
      if (current) current.count += 1;
      else map.set(label, { label, count: 1 });
    }
    return [...map.values()];
  }, [picked]);

  const selectShown = () => {
    if (!subject || year == null) return;
    setPicked((prev) => {
      const next = [...prev];
      for (const question of visible) {
        const chosenYear = paperYear(question, year);
        const key = pickKey(examType, subject.alocSlug, chosenYear, question.id);
        if (next.some((item) => item.key === key)) continue;
        if (next.length >= MAX_PICKS) break;
        next.push({
          key,
          examType,
          subjectSlug: subject.alocSlug,
          subjectLabel: subject.label,
          year: chosenYear,
          question,
        });
      }
      return next;
    });
  };

  const clearShown = () => {
    if (!subject || year == null) return;
    const shown = new Set(
      visible.map((question) => pickKey(examType, subject.alocSlug, paperYear(question, year), question.id))
    );
    setPicked((prev) => prev.filter((item) => !shown.has(item.key)));
  };

  const openAssign = () => {
    if (picked.length === 0) return fail('Tick at least one question.');
    setTitle(suggestedTitle(picked));
    setAssignOpen(true);
  };

  const save = async () => {
    if (!title.trim()) return fail('Give the assignment a title.');
    if (pickStudents ? studentIds.length === 0 : !targetClass) {
      return fail('Choose a class or at least one student.');
    }
    const due = parseDueDate(dueDate);
    if (due === 'invalid') return fail('Write the due date as YYYY-MM-DD, e.g. 2026-11-20.');
    const drafts = picked.map(toDraft);
    const unusable = drafts.findIndex((draft) => draft == null);
    if (unusable >= 0) {
      return fail(`Question ${unusable + 1} in your selection could not be copied. Remove it and try again.`);
    }
    const questions = drafts.filter((draft): draft is QuestionDraft => draft != null);
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
        question_count: questions.length,
        questions,
      });
      setAssignOpen(false);
      router.replace({ pathname: '/staff/assignments/[id]', params: { id: created.id } });
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Could not create the assignment.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <Screen title="Past questions">
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }

  return (
    <Screen title="Past questions" subtitle="WAEC and JAMB" scroll={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Muted>
          Tick questions from any WAEC or JAMB paper. Switch the exam, subject, or year and keep ticking —
          Physics 2006 and Mathematics 2013 can sit in the same assignment, and so can any other papers.
          A diagram on a question is shown to students.
        </Muted>

        <View style={styles.examRow}>
          {(['WAEC', 'JAMB'] as const).map((exam) => {
            const selected = examType === exam;
            return (
              <TouchableOpacity
                key={exam}
                style={[
                  styles.examCard,
                  { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.accent : t.card },
                ]}
                onPress={() => setExamType(exam)}
                accessibilityRole="button"
                accessibilityState={{ selected }}>
                <MaterialIcons name="quiz" size={22} color={selected ? '#000' : t.tint} />
                <ThemedText style={[styles.examLabel, selected && { color: '#000' }]}>{exam}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <Field
          label="Find a subject"
          value={subjectQuery}
          onChangeText={setSubjectQuery}
          placeholder="Type physics, maths, government…"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {subjects.length === 0 ? (
          <Muted>No subject matches that search.</Muted>
        ) : (
          <View style={styles.wrap}>
            {subjects.map((item) => (
              <Chip
                key={item.alocSlug}
                label={item.label}
                selected={subject?.alocSlug === item.alocSlug}
                onPress={() => setSubject(item)}
              />
            ))}
          </View>
        )}

        <SectionLabel>YEAR</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
          {years.map((item) => (
            <Chip key={item} label={String(item)} selected={year === item} onPress={() => setYear(item)} />
          ))}
        </ScrollView>

        {groups.length > 0 ? (
          <Card>
            <ThemedText style={styles.cardTitle}>In this assignment · {picked.length}</ThemedText>
            <Muted>These stay selected when you open another paper.</Muted>
            {groups.map((group) => (
              <View key={group.label} style={styles.pickedRow}>
                <ThemedText style={styles.flex}>
                  {group.label} · {group.count} question{group.count === 1 ? '' : 's'}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setPicked((prev) => prev.filter((item) => `${item.examType} ${item.subjectLabel} ${item.year}` !== group.label))}
                  accessibilityLabel={`Remove ${group.label}`}>
                  <ThemedText style={{ color: t.danger, fontWeight: '700' }}>Remove</ThemedText>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        ) : null}

        {!subject ? (
          <Card>
            <ThemedText style={styles.cardTitle}>Pick a subject to see the paper</ThemedText>
            <Muted>WAEC and JAMB use the same subject list. The questions change with the exam and year.</Muted>
          </Card>
        ) : paperLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={t.accent} />
            <Muted>Loading {examType} {subject.label} {year ?? ''}…</Muted>
          </View>
        ) : paperError ? (
          <Card>
            <ThemedText style={styles.cardTitle}>Could not load this paper</ThemedText>
            <Muted>{paperError}</Muted>
            <Button label="Try again" variant="secondary" onPress={() => setReloadToken((n) => n + 1)} />
          </Card>
        ) : (
          <>
            <View style={styles.paperHeader}>
              <ThemedText style={styles.cardTitle}>
                {examType} · {subject.label} · {year}
              </ThemedText>
              <Muted>
                {visible.length} question{visible.length === 1 ? '' : 's'}
                {picked.length > 0 ? ` · ${picked.length} selected in total` : ''}
              </Muted>
            </View>
            <Field
              label="Search these questions"
              value={questionQuery}
              onChangeText={setQuestionQuery}
              placeholder="Search the wording…"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.toolRow}>
              <View style={styles.switchRow}>
                <ThemedText>Show answers</ThemedText>
                <Switch value={showAnswers} onValueChange={setShowAnswers} trackColor={{ true: t.accent }} />
              </View>
              <TouchableOpacity onPress={selectShown}>
                <ThemedText style={{ color: t.tint, fontWeight: '700' }}>Select shown</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearShown}>
                <ThemedText style={{ color: t.muted, fontWeight: '700' }}>Clear shown</ThemedText>
              </TouchableOpacity>
            </View>
            {visible.length === 0 ? (
              <Muted>Nothing on this paper matches that search.</Muted>
            ) : (
              visible.map((question, index) => {
                const key = pickKey(examType, subject.alocSlug, paperYear(question, year ?? 0), question.id);
                const selected = pickedKeys.has(key);
                return (
                  <Card key={key} style={selected ? { borderColor: t.accent } : undefined}>
                    <TouchableOpacity
                      style={styles.qHeader}
                      onPress={() => toggleQuestion(question)}
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
                    {question.options.map((option) => {
                      const correct = showAnswers && option.id === question.correctOptionId;
                      return (
                        <View
                          key={option.id}
                          style={[styles.option, { borderColor: correct ? '#00C832' : t.border }]}>
                          <ThemedText style={{ fontWeight: '700', color: correct ? '#00C832' : t.text }}>
                            {option.id}
                          </ThemedText>
                          <View style={styles.flex}>
                            <RichPrompt
                              value={option.labelHtml}
                              color={correct ? '#00C832' : t.text}
                            />
                          </View>
                        </View>
                      );
                    })}
                    {showAnswers && question.explanationHtml ? (
                      <Muted>Explanation: {plainTextFromPracticeHtml(question.explanationHtml)}</Muted>
                    ) : null}
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {picked.length > 0 ? (
        <View style={[styles.footer, { borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button
            label={`Assign ${picked.length} selected`}
            icon="send"
            onPress={openAssign}
          />
        </View>
      ) : null}

      <Modal visible={assignOpen} animationType="slide" transparent onRequestClose={() => setAssignOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.cardTitle}>Assign to students</ThemedText>
              <TouchableOpacity onPress={() => setAssignOpen(false)} accessibilityLabel="Close">
                <MaterialIcons name="close" size={24} color={t.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
              <Muted>
                {picked.length} past question{picked.length === 1 ? '' : 's'}. Multiple choice is marked automatically.
              </Muted>
              <Field label="Title" value={title} onChangeText={setTitle} placeholder="Assignment title" />
              <Field
                label="Instructions"
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
              />
              <SectionLabel>WHO IS IT FOR?</SectionLabel>
              {!roster ? (
                <Muted>Loading your classes…</Muted>
              ) : roster.length === 0 ? (
                <Muted>No students in your school yet. A school admin can add student accounts.</Muted>
              ) : (
                <>
                  <View style={styles.switchRow}>
                    <ThemedText style={styles.flex}>Pick individual students</ThemedText>
                    <Switch value={pickStudents} onValueChange={setPickStudents} trackColor={{ true: t.accent }} />
                  </View>
                  <View style={styles.wrap}>
                    {pickStudents
                      ? allStudents.map((student) => (
                          <Chip
                            key={student.id}
                            label={`${student.name} (${student.className})`}
                            selected={studentIds.includes(student.id)}
                            onPress={() =>
                              setStudentIds((prev) =>
                                prev.includes(student.id)
                                  ? prev.filter((id) => id !== student.id)
                                  : [...prev, student.id]
                              )
                            }
                          />
                        ))
                      : roster.map((item) => (
                          <Chip
                            key={item.name}
                            label={`${item.name} · ${item.students.length}`}
                            selected={targetClass === item.name}
                            onPress={() => setTargetClass(item.name)}
                          />
                        ))}
                  </View>
                </>
              )}
              <SectionLabel>SELECTED</SectionLabel>
              {picked.map((item, index) => (
                <View key={item.key} style={styles.pickedRow}>
                  <ThemedText style={styles.flex} numberOfLines={2}>
                    {index + 1}. {item.examType} {item.subjectLabel} {item.year} —{' '}
                    {plainTextFromPracticeHtml(item.question.promptHtml)}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setPicked((prev) => prev.filter((row) => row.key !== item.key))}
                    accessibilityLabel="Remove question">
                    <MaterialIcons name="close" size={20} color={t.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <Button
                label="Create assignment"
                icon="send"
                onPress={save}
                loading={saving}
                disabled={picked.length === 0}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  scroll: { gap: 12, paddingBottom: 24 },
  examRow: { flexDirection: 'row', gap: 10 },
  examCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  examLabel: { fontSize: 16, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  yearRow: { flexDirection: 'row', paddingBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  paperHeader: { gap: 2 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qTitle: { fontSize: 15, fontWeight: '700' },
  prompt: { fontSize: 15, fontWeight: '600' },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    height: '90%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetBody: { gap: 12, paddingBottom: 12 },
  pickedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
