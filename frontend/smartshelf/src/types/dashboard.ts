import type { IgcsTextbook } from '@/src/types/igcse';
import type { PracticeExamType } from '@/src/types/exam';
import type { PracticeSessionSummary } from '@/src/types/practice';

export type BookReadingSummary = {
  book: IgcsTextbook;
  progressPercent: number;
  lastReadAt?: string;
};

export type ExamAverageScore = {
  examType: PracticeExamType;
  averagePercent: number;
  sessionCount: number;
};

export type DashboardData = {
  currentIgcsBook?: IgcsTextbook;
  books: BookReadingSummary[];
  recentSessions: PracticeSessionSummary[];
  averagesByExam: ExamAverageScore[];
  completedSessions: number;
  inProgressSessions: number;
  lastActivityAt?: string;
};
