/**
 * Canonical IGCSE course folders (matches backend `DEFAULT_SUBJECT_SLUGS` / `OPEN_IGCSE_SUBJECTS_JSON`).
 * Import per-subject modules from `./biology`, `./chemistry`, etc.
 */
export const IGCSE_COURSE_SLUGS = [
  'biology',
  'chemistry',
  'computer_science',
  'mathematics',
  'physics',
] as const;

export type IgcseCourseSlug = (typeof IGCSE_COURSE_SLUGS)[number];
