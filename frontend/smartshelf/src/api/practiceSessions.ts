import { apiRequest } from '@/services/api';
import { readApiError } from '@/src/lib/apiError';

export type RecordedPracticeSession = {
  id: string;
  exam_type: 'WAEC' | 'JAMB';
  subject: string;
  year: number | null;
  status: string;
  score_percent: number;
  correct_count: number;
  answered_count: number;
};

export type PracticeResponseInput = {
  question_id: string;
  selected_option_id: string;
  correct_option_id: string;
  is_correct: boolean;
  order_index: number;
};

/**
 * Saves a finished WAEC/JAMB session to the server so teachers (assignments)
 * and parents (dashboard) can see it.
 */
export async function recordCompletedPracticeSession(input: {
  examType: 'WAEC' | 'JAMB';
  subject: string;
  year?: number;
  scorePercent: number;
  correctCount: number;
  answeredCount: number;
  durationSeconds: number;
  responses: PracticeResponseInput[];
}): Promise<RecordedPracticeSession> {
  const created = await apiRequest('/v1/practice/sessions/', {
    method: 'POST',
    body: JSON.stringify({ exam_type: input.examType, subject: input.subject, year: input.year ?? null }),
  });
  if (!created.ok) throw new Error(await readApiError(created, 'Could not save your session.'));
  const session = (await created.json()) as RecordedPracticeSession;

  const done = await apiRequest(`/v1/practice/sessions/${session.id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'completed',
      score_percent: input.scorePercent,
      correct_count: input.correctCount,
      answered_count: input.answeredCount,
      duration_seconds: input.durationSeconds,
      responses: input.responses,
    }),
  });
  if (!done.ok) throw new Error(await readApiError(done, 'Could not save your session.'));
  return done.json();
}
