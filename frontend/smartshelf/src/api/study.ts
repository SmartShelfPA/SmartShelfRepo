import { apiRequest } from '@/services/api';
import { readApiError } from '@/src/lib/apiError';

export type TopicStatus = 'mastered' | 'retry' | 'new';

export type CatalogueBook = {
  id: string;
  title: string;
  subject: string;
  author: string;
  edition: string;
  isbn: string;
  publisher_name: string;
  curriculum: string;
  file_size_bytes: number;
  offline_allowed: boolean;
};

export type StudyPlanItem = {
  kind: 'assignment' | 'reading' | 'practice' | 'cards';
  id: string;
  title: string;
  detail: string;
  due_at?: string | null;
  overdue?: boolean;
  page?: number | null;
  asset_id?: string;
};

export type TopicSummary = {
  id: string;
  title: string;
  chapter_label: string;
  page_start: number | null;
  page_end: number | null;
  question_count: number;
  asset: CatalogueBook;
  status: TopicStatus;
  score_percent: number | null;
};

export type TopicQuestionPublic = {
  id: string;
  order: number;
  prompt: string;
  options: { id: string; label: string }[];
};

export type TopicQuestionRevealed = TopicQuestionPublic & {
  selected_option_id: string;
  correct_option_id: string;
  is_correct: boolean;
  explanation: string;
  review_label: string;
  review_page: number | null;
};

export type TopicAttemptResult = {
  attempt_id: string;
  score_percent: number;
  correct_count: number;
  total_count: number;
  status: TopicStatus;
  mastery_percent: number;
  questions: TopicQuestionRevealed[];
  asset: CatalogueBook;
};

export type ProgressReport = {
  reading_activity: { books_opened_this_week: number; note: string };
  understanding: {
    mastery_percent: number;
    topics: {
      id: string;
      title: string;
      subject: string;
      chapter_label: string;
      status: TopicStatus;
      score_percent: number | null;
      asset_id: string;
      review_page: number | null;
    }[];
  };
};

export type RevisionCard = {
  id: string;
  asset_id: string;
  asset_title: string;
  page: number;
  front: string;
  back: string;
  box: number;
  due: boolean;
  next_review_at: string;
};

export type TextbookLicence = {
  id: string;
  asset_id: string;
  title: string;
  target_class: string;
  term_label: string;
  starts_on: string;
  ends_on: string;
};

export type ImportedStudent = {
  row: number;
  full_name: string;
  username: string;
  email: string;
  student_class: string;
  temporary_password: string;
};

async function json<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error(await readApiError(res, fallback));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchStudyPlan(): Promise<StudyPlanItem[]> {
  const data = await json<{ items: StudyPlanItem[] }>(
    await apiRequest('/v1/student/study-plan/'),
    'Could not load your study plan.'
  );
  return data.items;
}

export async function fetchProgress(): Promise<ProgressReport> {
  return json(await apiRequest('/v1/student/progress/'), 'Could not load progress.');
}

export async function fetchTopics(): Promise<TopicSummary[]> {
  return json(await apiRequest('/v1/student/topics/'), 'Could not load topics.');
}

export async function fetchTopic(id: string): Promise<{
  id: string;
  title: string;
  chapter_label: string;
  page_start: number | null;
  page_end: number | null;
  asset: CatalogueBook;
  questions: TopicQuestionPublic[];
}> {
  return json(await apiRequest(`/v1/student/topics/${id}/`), 'Could not load this quiz.');
}

export async function submitTopicAttempt(
  id: string,
  answers: { question_id: string; selected_option_id: string }[]
): Promise<TopicAttemptResult> {
  return json(
    await apiRequest(`/v1/student/topics/${id}/attempts/`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
    'Could not submit the quiz.'
  );
}

export async function fetchCards(): Promise<RevisionCard[]> {
  return json(await apiRequest('/v1/student/cards/'), 'Could not load revision cards.');
}

export async function createCard(input: {
  asset_id: string;
  page: number;
  front: string;
  back: string;
}): Promise<{ id: string }> {
  return json(
    await apiRequest('/v1/student/cards/', { method: 'POST', body: JSON.stringify(input) }),
    'Could not save the card.'
  );
}

export async function reviewCard(id: string, knew: boolean): Promise<void> {
  await json(await apiRequest(`/v1/student/cards/${id}/`, { method: 'POST', body: JSON.stringify({ knew }) }), 'Could not update the card.');
}

export async function deleteCard(id: string): Promise<void> {
  await json(await apiRequest(`/v1/student/cards/${id}/`, { method: 'DELETE' }), 'Could not delete the card.');
}

export async function fetchReadingState(assetId: string): Promise<{ page: number; updated_at: string | null; synced: boolean }> {
  return json(await apiRequest(`/v1/student/reading/${assetId}/`), 'Could not load reading position.');
}

export async function saveReadingState(assetId: string, page: number): Promise<{ page: number; updated_at: string; synced: boolean }> {
  return json(
    await apiRequest(`/v1/student/reading/${assetId}/`, { method: 'PUT', body: JSON.stringify({ page }) }),
    'Could not sync reading position.'
  );
}

export async function fetchLicences(): Promise<TextbookLicence[]> {
  return json(await apiRequest('/v1/school/licences/'), 'Could not load licences.');
}

export async function createLicence(input: {
  asset_id: string;
  target_class: string;
  term_label: string;
  starts_on: string;
  ends_on: string;
}): Promise<{ id: string }> {
  return json(
    await apiRequest('/v1/school/licences/', { method: 'POST', body: JSON.stringify(input) }),
    'Could not save the licence.'
  );
}

export async function deleteLicence(id: string): Promise<void> {
  await json(await apiRequest(`/v1/school/licences/${id}/`, { method: 'DELETE' }), 'Could not remove the licence.');
}

export async function importStudents(csv: string): Promise<{ created: ImportedStudent[]; errors: { row: number; error: string }[] }> {
  return json(
    await apiRequest('/v1/school/members/import/', { method: 'POST', body: JSON.stringify({ csv }) }),
    'Could not import students.'
  );
}

export type StaffTopic = {
  id: string;
  title: string;
  chapter_label: string;
  page_start: number | null;
  page_end: number | null;
  asset_id: string;
  asset_title: string;
  question_count: number;
};

export async function fetchStaffTopics(): Promise<StaffTopic[]> {
  return json(await apiRequest('/v1/school/topics/'), 'Could not load chapter questions.');
}

export async function createStaffTopic(input: {
  asset_id: string;
  title: string;
  chapter_label: string;
  page_start: number | null;
  page_end: number | null;
  questions: {
    prompt: string;
    options: { id: string; label: string }[];
    correct_option_id: string;
    explanation: string;
    review_label: string;
    review_page: number | null;
  }[];
}): Promise<{ id: string }> {
  return json(
    await apiRequest('/v1/school/topics/', { method: 'POST', body: JSON.stringify(input) }),
    'Could not save the topic.'
  );
}

export async function deleteStaffTopic(id: string): Promise<void> {
  await json(await apiRequest(`/v1/school/topics/${id}/`, { method: 'DELETE' }), 'Could not delete the topic.');
}
