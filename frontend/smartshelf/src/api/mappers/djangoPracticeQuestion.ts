import type { NormalizedAnswerOption, NormalizedQuestion } from '@/src/types/practice';
import type { PracticeExamType } from '@/src/types/exam';

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

function pickNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseExamType(raw: unknown): PracticeExamType {
  const u = String(raw ?? '').toUpperCase();
  if (u === 'IGCSE') return 'IGCSE';
  if (u === 'JAMB') return 'JAMB';
  return 'WAEC';
}

/** Normalized question dict from Django `learning.services.normalize_question` JSON. */
export function djangoQuestionRecordToNormalized(
  raw: Record<string, unknown>
): NormalizedQuestion | null {
  const idRaw = raw.id ?? raw.uuid ?? raw.question_id ?? raw.pk;
  const id =
    pickString(idRaw) ??
    (idRaw !== null && idRaw !== undefined && String(idRaw).trim() !== ''
      ? String(idRaw)
      : undefined);
  if (!id) return null;

  const promptHtml =
    pickString(raw.prompt_html) ?? pickString(raw.promptHtml) ?? '<p></p>';

  const optionsIn = raw.options;
  const options: NormalizedAnswerOption[] = [];
  if (Array.isArray(optionsIn)) {
    optionsIn.forEach((item, idx) => {
      const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
      const oid =
        (o && (pickString(o.id) ?? pickString(o.key))) ?? String.fromCharCode(65 + idx);
      const labelHtml =
        (o && (pickString(o.label_html) ?? pickString(o.labelHtml))) ?? `<p>${oid}</p>`;
      options.push({ id: oid, labelHtml });
    });
  }

  if (options.length === 0) {
    ['A', 'B', 'C', 'D'].forEach((L) => options.push({ id: L, labelHtml: `<p>${L}</p>` }));
  }

  const correctOptionId =
    pickString(raw.correct_option_id) ??
    pickString(raw.correctOptionId) ??
    options[0]?.id ??
    'A';

  const explanationHtml =
    pickString(raw.explanation_html) ?? pickString(raw.explanationHtml) ?? undefined;

  const year = pickNum(raw.year) ?? new Date().getFullYear();
  const orderIndex = pickNum(raw.order_index) ?? pickNum(raw.orderIndex) ?? 0;

  const subject = pickString(raw.subject) ?? 'General';

  const source =
    raw.source && typeof raw.source === 'object'
      ? (raw.source as Record<string, unknown>)
      : undefined;

  return {
    id,
    examType: parseExamType(raw.exam_type ?? raw.examType),
    subject,
    year,
    promptHtml,
    options,
    correctOptionId,
    explanationHtml,
    orderIndex,
    source,
  };
}
