import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  fetchAiAnswerExplanation,
  hasBundledExplanation,
} from '@/src/api/explainAnswer';
import {
  fetchPracticeQuestions,
  PRACTICE_SESSION_QUESTION_TARGET,
} from '@/src/api/practice';
import { HtmlContent } from '@/src/components/practice/HtmlContent';
import { PracticeTimer } from '@/src/components/practice/PracticeTimer';
import { QuestionPalette } from '@/src/components/practice/QuestionPalette';
import { ScoreSummaryCard } from '@/src/components/practice/ScoreSummaryCard';
import { usePracticeHistoryStore } from '@/src/store/practiceHistoryStore';
import { parsePracticeExamType } from '@/src/types/exam';
import type { NormalizedQuestion } from '@/src/types/practice';

export default function PracticeSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    examType: string | string[];
    subject?: string | string[];
    subjectLabel?: string | string[];
    year?: string | string[];
  }>();

  const rawExam = Array.isArray(params.examType) ? params.examType[0] : params.examType;
  const examType = parsePracticeExamType(rawExam);
  /** ALOC `subject` slug (lower-cased when requesting questions). */
  const subject =
    (Array.isArray(params.subject) ? params.subject[0] : params.subject) ?? 'General';
  const subjectLabelRaw =
    Array.isArray(params.subjectLabel) ? params.subjectLabel[0] : params.subjectLabel;
  const subjectTitle = (subjectLabelRaw?.trim() || subject).trim();
  const yearNum = Number(Array.isArray(params.year) ? params.year[0] : params.year);

  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; target: number } | null>(null);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState(false);
  const [finished, setFinished] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [aiExplainById, setAiExplainById] = useState<Record<string, string>>({});
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);

  const addSession = usePracticeHistoryStore((s) => s.addSession);
  const sessionStartedAtRef = useRef<string>(new Date().toISOString());
  const scoreReportedRef = useRef(false);
  const explainAbortRef = useRef<AbortController | null>(null);
  const aiExplainCacheRef = useRef<Record<string, string>>({});

  useEffect(() => {
    sessionStartedAtRef.current = new Date().toISOString();
    scoreReportedRef.current = false;
  }, [retryToken, examType, subject, yearNum]);

  const load = useCallback(async () => {
    if (!examType) return;
    setLoading(true);
    setError(null);
    setLoadProgress({ loaded: 0, target: PRACTICE_SESSION_QUESTION_TARGET });
    try {
      const year = Number.isFinite(yearNum) ? yearNum : new Date().getFullYear();
      const qs = await fetchPracticeQuestions(
        { examType, subject, year },
        {
          onProgress: (loaded, target) => {
            setLoadProgress({ loaded, target });
          },
        }
      );
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load questions');
    } finally {
      setLoadProgress(null);
      setLoading(false);
    }
    // retryToken intentionally triggers refetch without participating in the fetch body
    void retryToken;
  }, [examType, subject, yearNum, retryToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    explainAbortRef.current?.abort();
    explainAbortRef.current = null;
    setAiExplainLoading(false);
  }, [index]);

  const loadAiExplanation = useCallback(
    async (question: NormalizedQuestion) => {
      if (!examType) return;
      if (hasBundledExplanation(question)) return;
      const keyPresent = !!process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
      if (!keyPresent) {
        setAiExplainError('Add EXPO_PUBLIC_OPENAI_API_KEY to frontend/.env and restart Expo.');
        return;
      }
      if (aiExplainCacheRef.current[question.id]) return;

      explainAbortRef.current?.abort();
      const ac = new AbortController();
      explainAbortRef.current = ac;

      setAiExplainLoading(true);
      setAiExplainError(null);
      try {
        const year = Number.isFinite(yearNum) ? yearNum : new Date().getFullYear();
        const text = await fetchAiAnswerExplanation(
          { examType, subject: subjectTitle, year, question },
          { signal: ac.signal }
        );
        aiExplainCacheRef.current[question.id] = text;
        setAiExplainById((prev) => ({ ...prev, [question.id]: text }));
      } catch (e) {
        const name =
          typeof e === 'object' &&
          e !== null &&
          'name' in e &&
          typeof (e as { name: unknown }).name === 'string'
            ? (e as { name: string }).name
            : '';
        if (name === 'AbortError') return;
        setAiExplainError(e instanceof Error ? e.message : 'Could not load explanation');
      } finally {
        setAiExplainLoading(false);
      }
    },
    [examType, subjectTitle, yearNum]
  );

  const q = questions[index];

  const answeredIndexes = useMemo(() => {
    const set = new Set<number>();
    questions.forEach((qq, i) => {
      if (answers[qq.id]) set.add(i);
    });
    return set;
  }, [answers, questions]);

  const score = useMemo(() => {
    let correct = 0;
    questions.forEach((qq) => {
      const sel = answers[qq.id];
      if (sel && sel === qq.correctOptionId) correct += 1;
    });
    const total = questions.length || 1;
    return { correct, total, percent: (correct / total) * 100 };
  }, [answers, questions]);

  const selectOption = (optionId: string) => {
    if (!q || finished) return;
    setAnswers((prev) => ({ ...prev, [q.id]: optionId }));
  };

  const finishSession = () => {
    setFinished(true);
    setSummaryOpen(true);
    if (!examType) return;
    if (scoreReportedRef.current) return;
    scoreReportedRef.current = true;
    addSession({
      id: `local-${Date.now()}`,
      examType,
      subject: subjectTitle,
      year: Number.isFinite(yearNum) ? yearNum : undefined,
      startedAt: sessionStartedAtRef.current,
      endedAt: new Date().toISOString(),
      status: 'completed',
      scorePercent: score.percent,
      answeredCount: questions.length,
      correctCount: score.correct,
    });
  };

  const retry = () => {
    explainAbortRef.current?.abort();
    explainAbortRef.current = null;
    aiExplainCacheRef.current = {};
    setAiExplainById({});
    setAiExplainError(null);
    setAiExplainLoading(false);
    setAnswers({});
    setIndex(0);
    setReveal(false);
    setFinished(false);
    setShowExplain(false);
    setSummaryOpen(false);
    scoreReportedRef.current = false;
    sessionStartedAtRef.current = new Date().toISOString();
    setRetryToken((t) => t + 1);
  };

  if (!examType) {
    return (
      <ThemedView style={[styles.wrap, { backgroundColor, paddingTop: insets.top }]}>
        <ThemedText style={{ color: mutedTextColor }}>Missing exam type</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.wrap, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="close" size={22} color={tintColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {examType} · {subjectTitle}
          </ThemedText>
          <ThemedText style={{ color: mutedTextColor, fontSize: 12 }}>
            {Number.isFinite(yearNum) ? yearNum : 'Year'} · Question {questions.length ? index + 1 : 0}/
            {questions.length}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={finishSession} style={styles.iconBtn} activeOpacity={0.85}>
          <ThemedText style={{ color: tintColor, fontWeight: '900' }}>End</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.timerRow}>
        <PracticeTimer running={!loading && questions.length > 0} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tintColor} />
          <ThemedText style={{ color: mutedTextColor, textAlign: 'center' }}>
            Loading question set (
            {loadProgress?.loaded ?? 0}/{loadProgress?.target ?? PRACTICE_SESSION_QUESTION_TARGET})…
          </ThemedText>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={{ color: mutedTextColor }}>{error}</ThemedText>
          <TouchableOpacity onPress={() => void load()} activeOpacity={0.85}>
            <ThemedText style={{ color: tintColor, fontWeight: '800' }}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={{ color: mutedTextColor }}>No questions for this filter.</ThemedText>
        </View>
      ) : (
        <>
          <QuestionPalette
            total={questions.length}
            currentIndex={index}
            answered={answeredIndexes}
            onSelect={(i) => {
              if (finished) return;
              setIndex(i);
              setReveal(false);
              setShowExplain(false);
            }}
            tintColor={tintColor}
            mutedColor={mutedTextColor}
            cardBg={cardBgColor}
            borderColor={borderColor}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: 12 }}
            showsVerticalScrollIndicator={false}>
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={[styles.cardLabel, { color: mutedTextColor }]}>Question</ThemedText>
              {q ? <HtmlContent html={q.promptHtml} color={textColor} /> : null}
            </View>

            <View style={{ gap: 10 }}>
              {q?.options.map((opt) => {
                const selected = answers[q.id] === opt.id;
                const isCorrect = opt.id === q.correctOptionId;
                const showStates = reveal || finished;
                const border =
                  showStates && isCorrect
                    ? tintColor
                    : showStates && selected && !isCorrect
                      ? '#FF5252'
                      : selected
                        ? tintColor
                        : borderColor;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.option, { borderColor: border, backgroundColor: cardBgColor }]}
                    onPress={() => selectOption(opt.id)}
                    activeOpacity={0.85}
                    disabled={finished}>
                    <View style={styles.optionRow}>
                      <View style={[styles.badge, { borderColor }]}>
                        <ThemedText style={{ color: textColor, fontWeight: '900' }}>{opt.id}</ThemedText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <HtmlContent html={opt.labelHtml} color={textColor} />
                      </View>
                      {showStates && isCorrect ? (
                        <MaterialIcons name="check-circle" size={20} color={tintColor} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.secondary, { borderColor }]}
                onPress={() => setReveal((v) => !v)}
                activeOpacity={0.85}>
                <MaterialIcons name="visibility" size={18} color={textColor} />
                <ThemedText style={{ color: textColor, fontWeight: '800' }}>
                  {reveal ? 'Hide answer' : 'Reveal answer'}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondary, { borderColor }]}
                onPress={() => {
                  const opening = !showExplain;
                  setShowExplain(opening);
                  if (opening && q) {
                    setAiExplainError(null);
                    void loadAiExplanation(q);
                  }
                }}
                activeOpacity={0.85}>
                <MaterialIcons name="menu-book" size={18} color={textColor} />
                <ThemedText style={{ color: textColor, fontWeight: '800' }}>
                  Explanation
                </ThemedText>
              </TouchableOpacity>
            </View>

            {showExplain && q ? (
              <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
                <ThemedText style={[styles.cardLabel, { color: mutedTextColor }]}>Explanation</ThemedText>
                {hasBundledExplanation(q) ? (
                  <>
                    <ThemedText style={[styles.explainSubLabel, { color: mutedTextColor }]}>
                      From question bank
                    </ThemedText>
                    <HtmlContent html={q.explanationHtml!} color={textColor} />
                  </>
                ) : null}

                {!hasBundledExplanation(q) && aiExplainLoading ? (
                  <View style={styles.explainLoadingRow}>
                    <ActivityIndicator color={tintColor} />
                    <ThemedText style={{ color: mutedTextColor }}>Generating AI summary…</ThemedText>
                  </View>
                ) : null}

                {!hasBundledExplanation(q) && aiExplainError ? (
                  <ThemedText style={{ color: '#FF5252' }}>{aiExplainError}</ThemedText>
                ) : null}

                {!hasBundledExplanation(q) && aiExplainById[q.id] ? (
                  <>
                    <ThemedText style={[styles.explainSubLabel, { color: mutedTextColor }]}>AI summary</ThemedText>
                    <ThemedText style={[styles.aiExplainBody, { color: textColor }]}>
                      {aiExplainById[q.id]}
                    </ThemedText>
                  </>
                ) : null}
              </View>
            ) : null}

            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.navBtn, { borderColor }]}
                disabled={index === 0 || finished}
                onPress={() => {
                  setIndex((i) => Math.max(0, i - 1));
                  setReveal(false);
                  setShowExplain(false);
                }}
                activeOpacity={0.85}>
                <MaterialIcons name="chevron-left" size={26} color={tintColor} />
                <ThemedText style={{ color: textColor, fontWeight: '900' }}>Prev</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navBtn, { borderColor }]}
                disabled={index >= questions.length - 1 || finished}
                onPress={() => {
                  setIndex((i) => Math.min(questions.length - 1, i + 1));
                  setReveal(false);
                  setShowExplain(false);
                }}
                activeOpacity={0.85}>
                <ThemedText style={{ color: textColor, fontWeight: '900' }}>Next</ThemedText>
                <MaterialIcons name="chevron-right" size={26} color={tintColor} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primary, { backgroundColor: tintColor }]}
              onPress={finishSession}
              activeOpacity={0.9}>
              <MaterialIcons name="flag" size={20} color="#000" />
              <ThemedText style={styles.primaryText}>Finish & score</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryFull, { borderColor }]} onPress={retry} activeOpacity={0.85}>
              <MaterialIcons name="replay" size={18} color={textColor} />
              <ThemedText style={{ color: textColor, fontWeight: '900' }}>Retry session</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </>
      )}

      <Modal visible={summaryOpen} transparent animationType="fade" onRequestClose={() => setSummaryOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBgColor, borderColor }]}>
            <ScoreSummaryCard
              scorePercent={score.percent}
              correct={score.correct}
              total={score.total}
              tintColor={tintColor}
              textColor={textColor}
              mutedColor={mutedTextColor}
              cardBg={cardBgColor}
              borderColor={borderColor}
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: tintColor }]}
              onPress={() => setSummaryOpen(false)}
              activeOpacity={0.9}>
              <ThemedText style={styles.modalBtnText}>Continue reviewing</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn2, { borderColor }]} onPress={() => router.back()} activeOpacity={0.9}>
              <ThemedText style={{ color: textColor, fontWeight: '900' }}>Back to shelf</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 8 },
  title: { fontSize: 16, fontWeight: '900' },
  timerRow: { paddingHorizontal: 12, paddingTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 12,
    gap: 10,
  },
  cardLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  option: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 12,
  },
  optionRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  secondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  navBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primary: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: '#000', fontWeight: '900', fontSize: 16 },
  secondaryFull: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    gap: 16,
  },
  modalBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: { color: '#000', fontWeight: '900' },
  modalBtn2: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  explainSubLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  explainLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiExplainBody: { fontSize: 15, lineHeight: 22 },
});
