import { apiRequest } from '@/services/api';
import { djangoQuestionRecordToNormalized } from '@/src/api/mappers/djangoPracticeQuestion';
import { normalizeQuestionList } from '@/src/api/mappers/questionFromUnknown';
import type { PracticeExamType } from '@/src/types/exam';
import type { NormalizedQuestion } from '@/src/types/practice';

export type PracticeQuery = {
  examType: PracticeExamType;
  subject: string;
  year: number;
};

/** Target unique questions aggregated from ALOC for one practice session. */
export const PRACTICE_SESSION_QUESTION_TARGET = 10;

export type FetchPracticeQuestionsOptions = {
  /** Fired whenever a new unique question is counted (starts at `0/target`). */
  onProgress?: (loadedUniqueCount: number, targetCount: number) => void;
};

type ALOCQuestionType = 'utme' | 'wassce' | 'post-utme';

type ReportQuestionPayload = {
  subject: string;
  questionId: string | number;
  type?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  message?: string;
  fullName?: string;
};

const ALOC_BASE_URL = 'https://questions.aloc.com.ng';
const ALOC_ACCESS_TOKEN = process.env.EXPO_PUBLIC_ALOC_ACCESS_TOKEN;

/** Human label in the app; `alocSlug` is sent to ALOC (`subject` query, lowercased). */
export type PracticeSubjectOption = { label: string; alocSlug: string };

/** Shared WAEC/JAMB practice picker; slugs follow common ALOC subject keys. */
export const ALOC_WAEC_JAMB_PRACTICE_SUBJECTS: PracticeSubjectOption[] = [
  { label: 'English language', alocSlug: 'english' },
  { label: 'Mathematics', alocSlug: 'mathematics' },
  { label: 'Commerce', alocSlug: 'commerce' },
  { label: 'Accounting', alocSlug: 'accounting' },
  { label: 'Biology', alocSlug: 'biology' },
  { label: 'Physics', alocSlug: 'physics' },
  { label: 'Chemistry', alocSlug: 'chemistry' },
  { label: 'English literature', alocSlug: 'englishlit' },
  { label: 'Government', alocSlug: 'government' },
  { label: 'Christian Religious Knowledge', alocSlug: 'crk' },
  { label: 'Geography', alocSlug: 'geography' },
  { label: 'Economics', alocSlug: 'economics' },
  { label: 'Islamic Religious Knowledge', alocSlug: 'irk' },
  { label: 'Civic Education', alocSlug: 'civic' },
  { label: 'Insurance', alocSlug: 'insurance' },
  { label: 'Current Affairs', alocSlug: 'currentaffairs' },
  { label: 'History', alocSlug: 'history' },
];

function getALOCType(examType: PracticeExamType): ALOCQuestionType {
  if (examType === 'IGCSE') {
    throw new Error('IGCSE practice uses the Open IGCSE provider via Django, not ALOC.');
  }
  return examType === 'WAEC' ? 'wassce' : 'utme';
}

function getALOCHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (ALOC_ACCESS_TOKEN) {
    headers.AccessToken = ALOC_ACCESS_TOKEN;
  }
  return headers;
}

const ALOC_REQUEST_TIMEOUT_MS = 20000;
/** Extra fetches to absorb duplicate IDs from the API */
const MAX_ALOC_FETCH_ATTEMPTS = 48;
const ALOC_FETCH_CONCURRENCY = 6;
const ALOC_BATCH_GAP_MS = 70;

function readAlocErrorMessage(raw: unknown): string | null {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!obj) return null;
  for (const key of ['detail', 'error', 'message'] as const) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function mockQuestions(q: PracticeQuery): NormalizedQuestion[] {
  const year = q.year;
  const subject = q.subject;
  const base = (idx: number): NormalizedQuestion => ({
    id: `mock-${q.examType}-${subject}-${year}-${idx}`,
    examType: q.examType,
    subject,
    year,
    promptHtml: `<p><strong>${q.examType}</strong> · ${subject} (${year}) — Question ${idx + 1}</p><p>Select the best answer.</p>`,
    options: [
      { id: 'A', labelHtml: '<p>First option</p>' },
      { id: 'B', labelHtml: '<p>Second option</p>' },
      { id: 'C', labelHtml: '<p>Third option</p>' },
      { id: 'D', labelHtml: '<p>Fourth option</p>' },
    ],
    correctOptionId: 'B',
    orderIndex: idx,
  });
  return Array.from({ length: PRACTICE_SESSION_QUESTION_TARGET }, (_, idx) => base(idx));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Single GET /api/v2/q — ALOC returns one question per response.
 * Returns null on network/parse errors (caller aggregates).
 */
async function fetchOneAlocQuestion(query: PracticeQuery): Promise<NormalizedQuestion | null> {
  const { examType, subject, year } = query;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ALOC_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${ALOC_BASE_URL}/api/v2/q?${new URLSearchParams({
        subject: subject.toLowerCase(),
        year: String(year),
        type: getALOCType(examType),
      }).toString()}`,
      {
        method: 'GET',
        headers: getALOCHeaders(),
        signal: controller.signal,
      }
    );
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      return null;
    }
    const mapped = normalizeQuestionList(raw, examType, { subject, year });
    return mapped[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** One guaranteed parseable question or a clear thrown error (auth, bad subject, empty body). */
async function fetchAlocQuestionStrict(query: PracticeQuery): Promise<NormalizedQuestion> {
  const { examType, subject, year } = query;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ALOC_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${ALOC_BASE_URL}/api/v2/q?${new URLSearchParams({
        subject: subject.toLowerCase(),
        year: String(year),
        type: getALOCType(examType),
      }).toString()}`,
      {
        method: 'GET',
        headers: getALOCHeaders(),
        signal: controller.signal,
      }
    );
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      const hint = readAlocErrorMessage(raw);
      throw new Error(
        hint ?? `Could not load questions (${response.status}). Check subject, year, and your ALOC token.`
      );
    }
    const mapped = normalizeQuestionList(raw, examType, { subject, year });
    if (mapped.length === 0) {
      throw new Error('No questions returned for this subject and year.');
    }
    return mapped[0]!;
  } finally {
    clearTimeout(timeoutId);
  }
}

type AlocPumpCounters = { fetches: number };

async function pumpAlocQuestionBatches(
  query: PracticeQuery,
  collected: NormalizedQuestion[],
  seenIds: Set<string>,
  counters: AlocPumpCounters,
  onProgress?: FetchPracticeQuestionsOptions['onProgress']
): Promise<void> {
  while (collected.length < PRACTICE_SESSION_QUESTION_TARGET && counters.fetches < MAX_ALOC_FETCH_ATTEMPTS) {
    const shortfall = PRACTICE_SESSION_QUESTION_TARGET - collected.length;
    const batchSize = Math.min(
      ALOC_FETCH_CONCURRENCY,
      shortfall + 2,
      MAX_ALOC_FETCH_ATTEMPTS - counters.fetches
    );
    if (batchSize <= 0) break;

    const batch = await Promise.all(
      Array.from({ length: batchSize }, () => fetchOneAlocQuestion(query))
    );
    counters.fetches += batchSize;

    for (const q of batch) {
      if (!q || seenIds.has(q.id)) continue;
      seenIds.add(q.id);
      collected.push(q);
      onProgress?.(collected.length, PRACTICE_SESSION_QUESTION_TARGET);
      if (collected.length >= PRACTICE_SESSION_QUESTION_TARGET) break;
    }

    if (collected.length < PRACTICE_SESSION_QUESTION_TARGET && counters.fetches < MAX_ALOC_FETCH_ATTEMPTS) {
      await delay(ALOC_BATCH_GAP_MS);
    }
  }
}

export async function fetchPracticeSubjects(
  examType: PracticeExamType
): Promise<PracticeSubjectOption[]> {
  if (examType === 'IGCSE') return [];
  void examType;
  return ALOC_WAEC_JAMB_PRACTICE_SUBJECTS;
}

export async function fetchPracticeYears(examType: PracticeExamType): Promise<number[]> {
  void examType;
  /** Years with seeded/local ALOC data; falls back to recent years when using hosted API. */
  return [2008, 2006, 2013, 2012, 2011, 2010, 2009, 2007, 2005, 2004];
}

/** Render cold start + server-side ALOC aggregation can exceed the default 10s API timeout. */
const PRACTICE_BACKEND_TIMEOUT_MS = 120_000;

function formatPracticeLoadError(error: unknown): string {
  if (error && typeof error === 'object') {
    const name = (error as Error).name ?? '';
    const message = (error as Error).message ?? '';
    if (name === 'AbortError' || /abort/i.test(message)) {
      return (
        'Practice is taking too long to load. The server may be waking up — wait a few seconds and tap Retry.'
      );
    }
    if (message.trim()) return message;
  }
  return 'Could not load practice questions. Check your connection and try again.';
}

async function fetchPracticeQuestionsFromBackend(
  query: PracticeQuery,
  options?: FetchPracticeQuestionsOptions
): Promise<NormalizedQuestion[]> {
  const onProgress = options?.onProgress;
  const examKind = query.examType === 'WAEC' ? 'waec' : 'jamb';
  onProgress?.(0, PRACTICE_SESSION_QUESTION_TARGET);

  let response: Response;
  try {
    response = await apiRequest(
      `/v1/practice/${examKind}/questions/?${new URLSearchParams({
        subject: query.subject.toLowerCase(),
        year: String(query.year),
      }).toString()}`,
      { timeoutMs: PRACTICE_BACKEND_TIMEOUT_MS }
    );
  } catch (error) {
    throw new Error(formatPracticeLoadError(error));
  }

  const raw = await response.json().catch(() => null);
  if (!response.ok) {
    const hint = readAlocErrorMessage(raw);
    throw new Error(
      hint ?? `SmartShelf practice API failed (${response.status}). Sign in and check server ALOC config.`
    );
  }

  const list = Array.isArray(raw) ? raw : [];
  const mapped = list
    .map((item) =>
      djangoQuestionRecordToNormalized(
        item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      )
    )
    .filter((q): q is NormalizedQuestion => q !== null)
    .slice(0, PRACTICE_SESSION_QUESTION_TARGET)
    .map((q, orderIndex) => ({ ...q, orderIndex }));

  if (mapped.length === 0) {
    throw new Error(
      readAlocErrorMessage(raw) ??
        'No questions returned from SmartShelf for this subject and year. Check ALOC_ACCESS_TOKEN on the server.'
    );
  }

  onProgress?.(mapped.length, PRACTICE_SESSION_QUESTION_TARGET);
  return mapped;
}

export async function fetchPracticeQuestions(
  query: PracticeQuery,
  options?: FetchPracticeQuestionsOptions
): Promise<NormalizedQuestion[]> {
  const onProgress = options?.onProgress;

  if (query.examType === 'IGCSE') {
    throw new Error('Open IGCSE MCQs run from the IGCSE bookshelf (MCQ revision), not the ALOC practice flow.');
  }

  /** Prefer Django backend so ALOC token stays on the server (production APK). */
  try {
    return await fetchPracticeQuestionsFromBackend(query, options);
  } catch (backendErr) {
    const token = ALOC_ACCESS_TOKEN?.trim();
    if (token) {
      console.warn('[Practice] Backend fetch failed; falling back to direct ALOC.', backendErr);
    } else if (__DEV__) {
      console.warn('[Practice] Backend unavailable; using local mock questions for UI dev.', backendErr);
      onProgress?.(0, PRACTICE_SESSION_QUESTION_TARGET);
      const mocks = mockQuestions(query);
      onProgress?.(mocks.length, PRACTICE_SESSION_QUESTION_TARGET);
      return mocks;
    } else {
      throw backendErr instanceof Error
        ? backendErr
        : new Error('Could not load practice questions from SmartShelf.');
    }
  }

  const token = ALOC_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'Practice questions are unavailable. Sign in and ensure the SmartShelf server has ALOC_ACCESS_TOKEN configured.'
    );
  }

  onProgress?.(0, PRACTICE_SESSION_QUESTION_TARGET);

  const seenIds = new Set<string>();
  const collected: NormalizedQuestion[] = [];
  const counters: AlocPumpCounters = { fetches: 0 };

  await pumpAlocQuestionBatches(query, collected, seenIds, counters, onProgress);

  if (collected.length === 0) {
    const first = await fetchAlocQuestionStrict(query);
    counters.fetches += 1;
    seenIds.add(first.id);
    collected.push(first);
    onProgress?.(collected.length, PRACTICE_SESSION_QUESTION_TARGET);
    await pumpAlocQuestionBatches(query, collected, seenIds, counters, onProgress);
  }

  const normalized = collected
    .slice(0, PRACTICE_SESSION_QUESTION_TARGET)
    .map((q, orderIndex) => ({ ...q, orderIndex }));

  onProgress?.(normalized.length, PRACTICE_SESSION_QUESTION_TARGET);
  return normalized;
}

export async function reportPracticeQuestion(payload: ReportQuestionPayload): Promise<boolean> {
  try {
    const response = await fetch(`${ALOC_BASE_URL}/api/r`, {
      method: 'POST',
      headers: getALOCHeaders(),
      body: JSON.stringify({
        subject: payload.subject.toLowerCase(),
        question_id: payload.questionId,
        type: payload.type,
        message: payload.message,
        full_name: payload.fullName,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
