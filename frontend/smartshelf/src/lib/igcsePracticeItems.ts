import type { IgcseTheoryNormalized } from '@/src/types/igcseNormalized';
import type { NormalizedQuestion } from '@/src/types/practice';

/** One step in an IGCSE topic practice session (MCQ and/or theory from Django). */
export type IgcsePracticeUnion =
  | { kind: 'selective'; question: NormalizedQuestion }
  | { kind: 'theory'; theory: IgcseTheoryNormalized };

export function buildIgcsePracticeSequence(
  selective: NormalizedQuestion[],
  theory: IgcseTheoryNormalized[],
  opts?: { maxSelective?: number; maxTheory?: number }
): IgcsePracticeUnion[] {
  const maxSel = opts?.maxSelective ?? 24;
  const maxThe = opts?.maxTheory ?? 15;
  const sel = selective.slice(0, Math.max(0, maxSel));
  const the = theory.slice(0, Math.max(0, maxThe));
  return [
    ...sel.map((question) => ({ kind: 'selective' as const, question })),
    ...the.map((t) => ({ kind: 'theory' as const, theory: t })),
  ];
}
