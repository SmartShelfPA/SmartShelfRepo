import { API_BASE_URL, apiRequest, getApiExtraHeaders, getToken } from '@/services/api';
import { readApiError } from '@/src/lib/apiError';

export type AssignmentKind = 'practice' | 'reading' | 'questions';
export type QuestionKind = 'mcq' | 'short' | 'theory';
export type SubmissionStatus = 'assigned' | 'submitted' | 'graded';

export const ASSIGNMENT_KIND_LABELS: Record<AssignmentKind, string> = {
  practice: 'Past-question practice',
  reading: 'Reading',
  questions: 'Questions',
};

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  mcq: 'Multiple choice',
  short: 'Short answer',
  theory: 'Theory / written',
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  assigned: 'Not started',
  submitted: 'Awaiting marking',
  graded: 'Marked',
};

export type QuestionOption = { id: string; label: string };

export type AssignmentQuestion = {
  id: string;
  order: number;
  kind: QuestionKind;
  prompt: string;
  options: QuestionOption[];
  max_marks: number;
  correct_option_id?: string;
  marking_guide?: string;
};

export type AssignmentAnswer = {
  id: string;
  question_id: string;
  selected_option_id: string;
  text_answer: string;
  is_correct: boolean | null;
  awarded_marks: number | null;
  feedback: string;
};

export type AssignmentResource = { id: string; title: string; subject: string };

export type Submission = {
  id: string;
  student_id: string;
  student_name: string;
  student_class: string;
  status: SubmissionStatus;
  score_percent: number | null;
  awarded_marks: number | null;
  response_text: string;
  teacher_feedback: string;
  practice_session_id: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  answers?: AssignmentAnswer[];
};

type AssignmentBase = {
  id: string;
  title: string;
  kind: AssignmentKind;
  instructions: string;
  exam_type: string;
  subject: string;
  year: number | null;
  question_count: number;
  resource: AssignmentResource | null;
  resource_pages: string;
  due_at: string | null;
  created_at: string;
};

export type StaffAssignmentSummary = AssignmentBase & {
  target_class: string;
  created_by_name: string;
  total_students: number;
  submitted_count: number;
  awaiting_marking_count: number;
  graded_count: number;
  avg_score_percent: number | null;
};

export type StaffAssignmentDetail = StaffAssignmentSummary & {
  questions: AssignmentQuestion[];
  submissions: Submission[];
};

export type StaffSubmissionDetail = Submission & {
  answers: AssignmentAnswer[];
  assignment: StaffAssignmentSummary;
  questions: AssignmentQuestion[];
};

export type StudentAssignment = AssignmentBase & {
  teacher_name: string;
  submission: Submission;
  questions?: AssignmentQuestion[];
};

export type RosterClass = {
  name: string;
  students: { id: string; name: string; username: string }[];
};

export type QuestionDraft = {
  kind: QuestionKind;
  prompt: string;
  options?: QuestionOption[];
  correct_option_id?: string;
  marking_guide?: string;
  max_marks?: number;
};

export type CreateAssignmentPayload = {
  title: string;
  kind: AssignmentKind;
  instructions?: string;
  target_class?: string;
  student_ids?: string[];
  exam_type?: 'WAEC' | 'JAMB' | '';
  subject?: string;
  year?: number | null;
  question_count?: number;
  resource_id?: string | null;
  resource_pages?: string;
  due_at?: string | null;
  questions?: QuestionDraft[];
};

export type GradeAnswerInput = { answer_id: string; awarded_marks?: number | null; feedback?: string };

async function json<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error(await readApiError(res, fallback));
  return res.json() as Promise<T>;
}

// Staff

export async function fetchRoster(): Promise<RosterClass[]> {
  const data = await json<{ classes: RosterClass[] }>(
    await apiRequest('/v1/staff/roster/'),
    'Could not load your classes.'
  );
  return data.classes;
}

export async function fetchStaffAssignments(): Promise<StaffAssignmentSummary[]> {
  return json(await apiRequest('/v1/staff/assignments/'), 'Could not load assignments.');
}

export async function createAssignment(payload: CreateAssignmentPayload): Promise<StaffAssignmentSummary> {
  return json(
    await apiRequest('/v1/staff/assignments/', { method: 'POST', body: JSON.stringify(payload) }),
    'Could not create the assignment.'
  );
}

export async function fetchStaffAssignment(id: string): Promise<StaffAssignmentDetail> {
  return json(await apiRequest(`/v1/staff/assignments/${id}/`), 'Could not load the assignment.');
}

export async function updateStaffAssignment(
  id: string,
  payload: Partial<Pick<CreateAssignmentPayload, 'title' | 'instructions' | 'due_at' | 'resource_pages'>>
): Promise<StaffAssignmentSummary> {
  return json(
    await apiRequest(`/v1/staff/assignments/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
    'Could not update the assignment.'
  );
}

export async function deleteStaffAssignment(id: string): Promise<void> {
  const res = await apiRequest(`/v1/staff/assignments/${id}/`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(await readApiError(res, 'Could not delete.'));
}

/** Gradebook CSV (for importing into an LMS or spreadsheet). */
export async function fetchAssignmentCsv(id: string): Promise<{ filename: string; csv: string }> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/v1/staff/assignments/${id}/export/`, {
    headers: {
      ...getApiExtraHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await readApiError(res, 'Could not export grades.'));
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return { filename: match?.[1] ?? 'grades.csv', csv: await res.text() };
}

export async function fetchStaffSubmission(id: string): Promise<StaffSubmissionDetail> {
  return json(await apiRequest(`/v1/staff/submissions/${id}/`), 'Could not load the submission.');
}

export async function gradeSubmission(
  id: string,
  payload: { answers?: GradeAnswerInput[]; teacher_feedback?: string }
): Promise<Submission> {
  return json(
    await apiRequest(`/v1/staff/submissions/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
    'Could not save marks.'
  );
}

// Student

export async function fetchStudentAssignments(): Promise<StudentAssignment[]> {
  return json(await apiRequest('/v1/student/assignments/'), 'Could not load assignments.');
}

export async function fetchStudentAssignment(id: string): Promise<StudentAssignment> {
  return json(await apiRequest(`/v1/student/assignments/${id}/`), 'Could not load the assignment.');
}

export type StudentSubmitPayload =
  | { answers: { question_id: string; selected_option_id?: string; text_answer?: string }[] }
  | { practice_session_id: string }
  | { response_text: string };

export async function submitStudentAssignment(
  id: string,
  payload: StudentSubmitPayload
): Promise<StudentAssignment> {
  return json(
    await apiRequest(`/v1/student/assignments/${id}/submit/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    'Could not submit.'
  );
}
