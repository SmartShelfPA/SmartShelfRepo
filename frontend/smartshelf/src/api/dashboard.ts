import { apiRequest } from '@/services/api';
import { MOCK_IGCSE_EPUB_URL } from '@/src/api/igcseBooks';
import type { BookReadingSummary, DashboardData, ExamAverageScore } from '@/src/types/dashboard';
import type { IgcsTextbook } from '@/src/types/igcse';
import type { PracticeExamType } from '@/src/types/exam';
import type { PracticeSessionSummary } from '@/src/types/practice';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function mapTextbook(raw: unknown): IgcsTextbook | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = o.id != null ? String(o.id) : '';
  const title = typeof o.title === 'string' ? o.title : '';
  const epubUrl =
    typeof o.epub_url === 'string'
      ? o.epub_url
      : typeof o.epubUrl === 'string'
        ? o.epubUrl
        : '';
  if (!id || !title) return null;
  return {
    id,
    title,
    subject: typeof o.subject === 'string' ? o.subject : '',
    epubUrl,
    progressPercent:
      typeof o.progress_percent === 'number'
        ? o.progress_percent
        : typeof o.progressPercent === 'number'
          ? o.progressPercent
          : undefined,
    lastReadAt:
      typeof o.last_read_at === 'string'
        ? o.last_read_at
        : typeof o.lastReadAt === 'string'
          ? o.lastReadAt
          : undefined,
  };
}

function mapBookRow(raw: unknown): BookReadingSummary | null {
  const o = asRecord(raw);
  if (!o) return null;
  const book = mapTextbook(o.book);
  if (!book) return null;
  return {
    book,
    progressPercent: Number(o.progress_percent ?? o.progressPercent ?? book.progressPercent ?? 0),
    lastReadAt:
      typeof o.last_read_at === 'string'
        ? o.last_read_at
        : typeof o.lastReadAt === 'string'
          ? o.lastReadAt
          : undefined,
  };
}

function mapSession(raw: unknown): PracticeSessionSummary | null {
  const o = asRecord(raw);
  if (!o || o.id == null) return null;
  const examRaw = o.exam_type ?? o.examType;
  const startedRaw = o.started_at ?? o.startedAt;
  if (typeof examRaw !== 'string' || typeof startedRaw !== 'string') return null;
  return {
    id: String(o.id),
    examType: examRaw as PracticeExamType,
    subject: typeof o.subject === 'string' ? o.subject : '',
    year: typeof o.year === 'number' ? o.year : undefined,
    startedAt: startedRaw,
    endedAt:
      typeof o.ended_at === 'string'
        ? o.ended_at
        : typeof o.endedAt === 'string'
          ? o.endedAt
          : undefined,
    status: (typeof o.status === 'string' ? o.status : 'completed') as PracticeSessionSummary['status'],
    scorePercent: Number(o.score_percent ?? o.scorePercent ?? 0),
    answeredCount: Number(o.answered_count ?? o.answeredCount ?? 0),
    correctCount: Number(o.correct_count ?? o.correctCount ?? 0),
  };
}

function mapAverage(raw: unknown): ExamAverageScore | null {
  const o = asRecord(raw);
  if (!o) return null;
  const examRaw = o.exam_type ?? o.examType;
  if (typeof examRaw !== 'string' || !examRaw) return null;
  return {
    examType: examRaw as PracticeExamType,
    averagePercent: Number(o.average_percent ?? o.averagePercent ?? 0),
    sessionCount: Number(o.session_count ?? o.sessionCount ?? 0),
  };
}

function normalizeDashboard(raw: unknown): DashboardData | null {
  const d = asRecord(raw);
  if (!d) return null;

  const booksRaw = d.books;
  const books = Array.isArray(booksRaw)
    ? booksRaw.map(mapBookRow).filter((row): row is BookReadingSummary => row !== null)
    : [];

  const sessionsRaw = d.recent_sessions ?? d.recentSessions;
  const recentSessions = Array.isArray(sessionsRaw)
    ? sessionsRaw.map(mapSession).filter((s): s is PracticeSessionSummary => s !== null)
    : [];

  const averagesRaw = d.averages_by_exam ?? d.averagesByExam;
  const averagesByExam = Array.isArray(averagesRaw)
    ? averagesRaw.map(mapAverage).filter((row): row is ExamAverageScore => row !== null)
    : [];

  const currentRaw = d.current_igcse_book ?? d.currentIgcsBook;
  const currentIgcsBook = currentRaw ? mapTextbook(currentRaw) ?? undefined : undefined;

  const lastActivityRaw = d.last_activity_at ?? d.lastActivityAt;

  return {
    currentIgcsBook,
    books,
    recentSessions,
    averagesByExam,
    completedSessions: Number(d.completed_sessions ?? d.completedSessions ?? 0),
    inProgressSessions: Number(d.in_progress_sessions ?? d.inProgressSessions ?? 0),
    lastActivityAt: typeof lastActivityRaw === 'string' ? lastActivityRaw : undefined,
  };
}

function mockDashboard(): DashboardData {
  const currentBook: IgcsTextbook = {
    id: 'mock-current',
    title: 'Currently reading (mock)',
    subject: 'English',
    epubUrl: MOCK_IGCSE_EPUB_URL,
    progressPercent: 37,
    lastReadAt: new Date(Date.now() - 3600_000).toISOString(),
  };

  const recent: PracticeSessionSummary[] = [
    {
      id: 'sess-waec-1',
      examType: 'WAEC',
      subject: 'Mathematics',
      year: 2023,
      startedAt: new Date(Date.now() - 86400_000).toISOString(),
      endedAt: new Date(Date.now() - 86340_000).toISOString(),
      status: 'completed',
      scorePercent: 72,
      answeredCount: 40,
      correctCount: 29,
    },
    {
      id: 'sess-jamb-1',
      examType: 'JAMB',
      subject: 'English',
      year: 2024,
      startedAt: new Date(Date.now() - 172800_000).toISOString(),
      endedAt: new Date(Date.now() - 172700_000).toISOString(),
      status: 'completed',
      scorePercent: 81,
      answeredCount: 60,
      correctCount: 49,
    },
  ];

  return {
    currentIgcsBook: currentBook,
    books: [
      {
        book: currentBook,
        progressPercent: 37,
        lastReadAt: currentBook.lastReadAt,
      },
      {
        book: {
          id: 'mock-b2',
          title: 'Biology Compendium',
          subject: 'Biology',
          epubUrl: MOCK_IGCSE_EPUB_URL,
        },
        progressPercent: 8,
      },
    ],
    recentSessions: recent,
    averagesByExam: [
      { examType: 'WAEC', averagePercent: 68, sessionCount: 4 },
      { examType: 'JAMB', averagePercent: 74, sessionCount: 2 },
    ],
    completedSessions: 6,
    inProgressSessions: 1,
    lastActivityAt: new Date(Date.now() - 1800_000).toISOString(),
  };
}

export async function fetchDashboard(): Promise<DashboardData> {
  try {
    const response = await apiRequest('/v1/dashboard/', { method: 'GET' });
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      return mockDashboard();
    }
    const normalized = normalizeDashboard(raw);
    return normalized ?? mockDashboard();
  } catch {
    return mockDashboard();
  }
}
