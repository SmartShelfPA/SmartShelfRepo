import { apiRequest } from '@/services/api';

export type StudentStatus = 'on_track' | 'falling_behind' | 'inactive' | 'needs_review';

export interface TeacherClassOverview {
  id: string;
  name: string;
  totalStudents: number;
  activeThisWeek: number;
  avgStudyMinutes: number;
  avgCompletionRate: number;
  topWeakTopics: string[];
}

export interface TeacherStudent {
  id: string;
  classId: string;
  className: string;
  name: string;
  status: StudentStatus;
  lastActiveAt: string | null;
  booksOpened: number;
  chaptersRead: number;
  readingMinutes: number;
  avgQuizScore: number | null;
  assignmentsSubmitted: number;
  strengths: string[];
  weaknesses: string[];
}

export interface TeacherAssignment {
  id: string;
  title: string;
  textbook: string;
  chapter: string;
  assignedAt: string;
  startedCount: number;
  completedCount: number;
  totalStudents: number;
  avgScore: number | null;
  className: string;
}

export interface TeacherIntervention {
  id: string;
  studentId: string;
  studentName: string;
  flag: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

export interface TeacherNote {
  id: string;
  studentId: string;
  studentName: string;
  note: string;
  sharedWithParent: boolean;
  createdAt: string;
}

export interface TeacherProgressTrend {
  weekLabel: string;
  classAvgScore: number;
  classAvgMinutes: number;
}

export interface TeacherDashboardData {
  teacherName: string;
  staffRole: string;
  classes: TeacherClassOverview[];
  students: TeacherStudent[];
  assignments: TeacherAssignment[];
  interventions: TeacherIntervention[];
  notes: TeacherNote[];
  progressTrends: TeacherProgressTrend[];
}

const FALLBACK: TeacherDashboardData = {
  teacherName: 'Teacher',
  staffRole: 'Teacher',
  classes: [
    {
      id: 'grade-8a',
      name: 'Grade 8A',
      totalStudents: 24,
      activeThisWeek: 18,
      avgStudyMinutes: 95,
      avgCompletionRate: 62,
      topWeakTopics: ['Algebra', 'Comprehension'],
    },
  ],
  students: [
    {
      id: 's1',
      classId: 'grade-8a',
      className: 'Grade 8A',
      name: 'Ada O.',
      status: 'on_track',
      lastActiveAt: new Date().toISOString(),
      booksOpened: 3,
      chaptersRead: 12,
      readingMinutes: 120,
      avgQuizScore: 78,
      assignmentsSubmitted: 5,
      strengths: ['Mathematics'],
      weaknesses: ['English'],
    },
  ],
  assignments: [],
  interventions: [],
  notes: [],
  progressTrends: [
    { weekLabel: 'Week 1', classAvgScore: 65, classAvgMinutes: 80 },
    { weekLabel: 'Week 2', classAvgScore: 68, classAvgMinutes: 90 },
  ],
};

export async function fetchTeacherDashboard(): Promise<TeacherDashboardData> {
  try {
    const res = await apiRequest('/v1/staff/dashboard/');
    if (!res.ok) throw new Error('Failed to load teacher dashboard');
    return res.json();
  } catch {
    return FALLBACK;
  }
}

export async function createTeacherNote(payload: {
  student_id: string;
  note: string;
  shared_with_parent?: boolean;
}): Promise<TeacherNote> {
  const res = await apiRequest('/v1/staff/notes/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save note');
  }
  return res.json();
}
