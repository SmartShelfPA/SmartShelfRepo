import type { PracticeExamType } from '@/src/types/exam';

/**
 * Normalized in-app question shape. All API responses must map into this type
 * so UI never depends on a single backend schema.
 */
export type NormalizedAnswerOption = {
  id: string;
  /** Safe HTML fragment for rich prompts (sanitized at render time if needed) */
  labelHtml: string;
};

export type NormalizedQuestion = {
  id: string;
  examType: PracticeExamType;
  subject: string;
  year: number;
  /** Primary prompt — HTML fragment */
  promptHtml: string;
  options: NormalizedAnswerOption[];
  correctOptionId: string;
  explanationHtml?: string;
  orderIndex: number;
  /** Optional metadata for debugging / future analytics */
  source?: Record<string, unknown>;
};

export type PracticeSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export type PracticeSessionSummary = {
  id: string;
  examType: PracticeExamType;
  subject: string;
  year?: number;
  startedAt: string;
  endedAt?: string;
  status: PracticeSessionStatus;
  scorePercent: number;
  answeredCount: number;
  correctCount: number;
};
