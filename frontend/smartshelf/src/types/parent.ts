export type ChildStatus = 'on_track' | 'needs_attention' | 'needs_review' | 'inactive';

export type AssignmentStatus = 'assigned' | 'submitted' | 'graded';

export interface ParentChildAssignment {
  id: string;
  title: string;
  kind: 'practice' | 'reading' | 'questions';
  teacherName: string;
  dueAt: string | null;
  status: AssignmentStatus;
  isOverdue: boolean;
  scorePercent: number | null;
  teacherFeedback: string;
  submittedAt: string | null;
}

export interface ParentChildPractice {
  sessionsThisWeek: number;
  completedSessions: number;
  avgScorePercent: number | null;
  recent: {
    id: string;
    examType: string;
    subject: string;
    year: number | null;
    scorePercent: number;
    startedAt: string;
  }[];
}

export interface ParentChildReading {
  id: string;
  title: string;
  progressPercent: number;
  lastReadAt: string | null;
}

export interface ParentChildNote {
  id: string;
  teacherName: string;
  note: string;
  createdAt: string;
}

export interface ParentChild {
  id: string;
  name: string;
  avatarUrl?: string;
  className?: string;
  schoolName?: string;
  status?: ChildStatus;
  lastActiveAt?: string | null;
  currentTasks: number;
  completedTasks: number;
  shelfId: string;
  reading?: ParentChildReading[];
  practice?: ParentChildPractice;
  assignments?: ParentChildAssignment[];
  teacherNotes?: ParentChildNote[];
}

export type ShelfItemStatus = 'ok' | 'low' | 'out';

export interface ShelfItemSummary {
  id: string;
  name: string;
  quantity: number;
  status: ShelfItemStatus;
}

export interface ParentDashboardData {
  parentName: string;
  totalChildren: number;
  totalItemsTracked: number;
  children: ParentChild[];
  itemsByChild: Record<string, ShelfItemSummary[]>;
}
