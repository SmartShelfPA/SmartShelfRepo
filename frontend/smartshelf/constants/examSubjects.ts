/**
 * Exam board subject configurations.
 * `key` matches Book.subject for filtering textbooks.
 */

export type SubjectEntry = { key: string; label: string };

export type SubjectGroup = {
  name: string;
  subjects: SubjectEntry[];
};

export type ExamBoardSubjects = {
  groups: SubjectGroup[];
};

/** IGCSE (Cambridge International) - 70+ subjects, grouped by category */
export const IGCSE_SUBJECTS: ExamBoardSubjects = {
  groups: [
    {
      name: 'Languages',
      subjects: [
        { key: 'English', label: 'English (First Language, Second Language, Literature)' },
        { key: 'Arabic', label: 'Arabic (First Language, Foreign Language)' },
        { key: 'French', label: 'French (First Language, Foreign Language)' },
        { key: 'Chinese', label: 'Chinese (First Language, Second Language, Mandarin)' },
        { key: 'German', label: 'German (First Language, Foreign Language)' },
        { key: 'Japanese', label: 'Japanese (Foreign Language)' },
        { key: 'Hindi', label: 'Hindi as a Second Language' },
        { key: 'Italian', label: 'Italian (Foreign Language)' },
        { key: 'Portuguese', label: 'Portuguese (First Language)' },
        { key: 'Afrikaans', label: 'Afrikaans (Second Language)' },
      ],
    },
    {
      name: 'Sciences',
      subjects: [
        { key: 'Biology', label: 'Biology' },
        { key: 'Chemistry', label: 'Chemistry' },
        { key: 'Physics', label: 'Physics' },
        { key: 'Combined Science', label: 'Combined Science' },
        { key: 'Coordinated Science', label: 'Coordinated Science (Double Award)' },
        { key: 'Environmental Management', label: 'Environmental Management' },
      ],
    },
    {
      name: 'Mathematics',
      subjects: [
        { key: 'Mathematics', label: 'Mathematics' },
        { key: 'Additional Mathematics', label: 'Additional Mathematics' },
        { key: 'International Mathematics', label: 'International Mathematics' },
      ],
    },
    {
      name: 'Humanities & Social Sciences',
      subjects: [
        { key: 'History', label: 'History' },
        { key: 'Geography', label: 'Geography' },
        { key: 'Economics', label: 'Economics' },
        { key: 'Sociology', label: 'Sociology' },
        { key: 'Global Perspectives', label: 'Global Perspectives' },
        { key: 'Religious Studies', label: 'Religious Studies' },
      ],
    },
    {
      name: 'Creative, Technical & Professional',
      subjects: [
        { key: 'Art & Design', label: 'Art & Design' },
        { key: 'Computer Science', label: 'Computer Science' },
        { key: 'ICT/CS', label: 'Information & Communication Technology (ICT)' },
        { key: 'Design & Technology', label: 'Design & Technology' },
        { key: 'Drama', label: 'Drama' },
        { key: 'Music', label: 'Music' },
        { key: 'Business Studies', label: 'Business Studies' },
        { key: 'Accounting', label: 'Accounting' },
        { key: 'Enterprise', label: 'Enterprise' },
        { key: 'Food & Nutrition', label: 'Food & Nutrition' },
        { key: 'Physical Education', label: 'Physical Education' },
      ],
    },
  ],
};

/** WAEC (WASSCE) - Official approved subjects */
export const WAEC_SUBJECTS: ExamBoardSubjects = {
  groups: [
    {
      name: 'Core & Compulsory',
      subjects: [
        { key: 'English', label: 'English Language' },
        { key: 'Mathematics', label: 'General Mathematics' },
        { key: 'Civic Education', label: 'Civic Education' },
      ],
    },
    {
      name: 'Sciences',
      subjects: [
        { key: 'Biology', label: 'Biology' },
        { key: 'Chemistry', label: 'Chemistry' },
        { key: 'Physics', label: 'Physics' },
        { key: 'Agricultural Science', label: 'Agriculture' },
      ],
    },
    {
      name: 'Humanities & Social Sciences',
      subjects: [
        { key: 'Commerce', label: 'Commerce' },
        { key: 'Accounting', label: 'Accounting' },
        { key: 'Christian Religious Studies', label: 'Christian Religious Studies' },
        { key: 'Islamic Studies', label: 'Islamic Studies' },
        { key: 'Economics', label: 'Economics' },
        { key: 'Geography', label: 'Geography' },
        { key: 'Government', label: 'Government' },
        { key: 'Literature in English', label: 'Literature in English' },
        { key: 'History', label: 'History' },
      ],
    },
    {
      name: 'Languages',
      subjects: [
        { key: 'Hausa', label: 'Hausa' },
        { key: 'Igbo', label: 'Igbo' },
        { key: 'Yoruba', label: 'Yoruba' },
      ],
    },
    {
      name: 'Mathematics (Advanced)',
      subjects: [
        { key: 'Further Mathematics', label: 'Further Mathematics' },
      ],
    },
  ],
};

/** JAMB (UTME) - Common subjects by course type */
export const JAMB_SUBJECTS: ExamBoardSubjects = {
  groups: [
    {
      name: 'Compulsory',
      subjects: [
        { key: 'Use of English', label: 'Use of English (Compulsory for all)' },
      ],
    },
    {
      name: 'Medicine & Health Sciences',
      subjects: [
        { key: 'Biology', label: 'Biology' },
        { key: 'Chemistry', label: 'Chemistry' },
        { key: 'Physics', label: 'Physics' },
      ],
    },
    {
      name: 'Engineering',
      subjects: [
        { key: 'Mathematics', label: 'Mathematics' },
        { key: 'Physics', label: 'Physics' },
        { key: 'Chemistry', label: 'Chemistry' },
      ],
    },
    {
      name: 'Social Sciences & Arts',
      subjects: [
        { key: 'Economics', label: 'Economics' },
        { key: 'Government', label: 'Government' },
        { key: 'History', label: 'History' },
        { key: 'Geography', label: 'Geography' },
        { key: 'Literature in English', label: 'Literature in English' },
        { key: 'CRS (Christian Religious Studies)', label: 'Christian Religious Studies (CRS)' },
        { key: 'IRS (Islamic Religious Studies)', label: 'Islamic Religious Studies (IRS)' },
        { key: 'Commerce', label: 'Commerce' },
        { key: 'Art', label: 'Art' },
      ],
    },
    {
      name: 'Sciences & Agriculture',
      subjects: [
        { key: 'Agricultural Science', label: 'Agricultural Science' },
      ],
    },
  ],
};

export const EXAM_SUBJECTS: Record<string, ExamBoardSubjects> = {
  IGCSE: IGCSE_SUBJECTS,
  WAEC: WAEC_SUBJECTS,
  JAMB: JAMB_SUBJECTS,
};

/** Get all subject keys for an exam board (flat list for filtering) */
export function getAllSubjectKeys(board: string): string[] {
  const config = EXAM_SUBJECTS[board.toUpperCase()];
  if (!config) return [];
  return config.groups.flatMap((g) => g.subjects.map((s) => s.key));
}
