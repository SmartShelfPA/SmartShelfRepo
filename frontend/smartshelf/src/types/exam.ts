/** Practice exam engines supported by the shared HTML5 practice flow. */
export type PracticeExamType = 'WAEC' | 'JAMB' | 'IGCSE';

export function parsePracticeExamType(raw: string | undefined): PracticeExamType | null {
  if (!raw) return null;
  const u = raw.trim().toUpperCase();
  if (u === 'WAEC' || u === 'JAMB' || u === 'IGCSE') return u;
  return null;
}
