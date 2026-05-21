import type { PracticeExamType } from '@/src/types/exam';
import type { NormalizedAnswerOption, NormalizedQuestion } from '@/src/types/practice';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

function pickNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** ALOC returns numeric `id`; must stringify or every question dedupes to the same fallback id. */
function pickQuestionIdScalar(obj: Record<string, unknown>): string | undefined {
  for (const key of ['id', 'question_id', 'pk'] as const) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function normalizeAnswerKey(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  const optionMatch = /^OPTION\s+([A-Z])$/i.exec(cleaned);
  if (optionMatch) return optionMatch[1]!.toUpperCase();
  return cleaned;
}

/** Map API object keys (e.g. "a", "option_b") to option ids "A", "B", … */
function normalizeOptionKey(key: string): string {
  const k = key.trim();
  if (/^[a-z]$/i.test(k)) return k.toUpperCase();
  const opt = /^option[_\s-]?([a-z])$/i.exec(k);
  if (opt) return opt[1]!.toUpperCase();
  return k;
}

/** Stable order: A, B, … Z, then other keys alphabetically */
function compareOptionIds(a: string, b: string): number {
  const isSingleLetter = (id: string) => /^[A-Z]$/.test(id);
  const aLetter = isSingleLetter(a);
  const bLetter = isSingleLetter(b);
  if (aLetter && bLetter) return a.charCodeAt(0) - b.charCodeAt(0);
  if (aLetter && !bLetter) return -1;
  if (!aLetter && bLetter) return 1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/**
 * Maps arbitrary API payloads into `NormalizedQuestion`.
 * Supports several likely backend shapes without hardcoding the UI to one of them.
 */
export function normalizeQuestionPayload(
  raw: unknown,
  examType: PracticeExamType,
  fallbacks: { subject: string; year: number; orderIndex: number }
): NormalizedQuestion | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const id =
    pickString(obj.uuid) ??
    pickQuestionIdScalar(obj) ??
    `${examType}-${fallbacks.subject}-${fallbacks.year}-${fallbacks.orderIndex}`;

  const subject =
    pickString(obj.subject) ??
    pickString(obj.course) ??
    pickString(obj.topic) ??
    fallbacks.subject;

  const year =
    pickNumber(obj.year) ??
    pickNumber(obj.exam_year) ??
    pickNumber(obj.session_year) ??
    fallbacks.year;

  const promptHtml =
    pickString(obj.prompt_html) ??
    pickString(obj.promptHtml) ??
    pickString(obj.question_html) ??
    pickString(obj.questionHtml) ??
    pickString(obj.text_html) ??
    pickString(obj.text) ??
    pickString(obj.question) ??
    '<p>Question</p>';

  const optionsRaw = obj.options ?? obj.option ?? obj.choices ?? obj.answers;
  const options: NormalizedAnswerOption[] = [];

  if (Array.isArray(optionsRaw)) {
    optionsRaw.forEach((item, idx) => {
      const or = asRecord(item);
      const oid =
        (or && (pickString(or.id) ?? pickString(or.key) ?? pickString(or.option_id))) ??
        `opt-${idx}`;
      const labelHtml =
        (or &&
          (pickString(or.label_html) ??
            pickString(or.labelHtml) ??
            pickString(or.text_html) ??
            pickString(or.text))) ??
        pickString(item) ??
        `Option ${idx + 1}`;
      options.push({ id: normalizeOptionKey(oid), labelHtml });
    });
  } else if (optionsRaw && typeof optionsRaw === 'object') {
    const entries = Object.entries(optionsRaw as Record<string, unknown>)
      .map(([key, val]) => {
        const labelHtml = pickString(val);
        if (!labelHtml) return null;
        const id = normalizeOptionKey(key || '');
        if (!id) return null;
        return { id, labelHtml };
      })
      .filter((o): o is { id: string; labelHtml: string } => o !== null);
    entries.sort((x, y) => compareOptionIds(x.id, y.id));
    options.push(...entries);
  }

  const optionA = pickString(obj.option_a) ?? pickString(obj.optionA);
  const optionB = pickString(obj.option_b) ?? pickString(obj.optionB);
  const optionC = pickString(obj.option_c) ?? pickString(obj.optionC);
  const optionD = pickString(obj.option_d) ?? pickString(obj.optionD);
  if (options.length === 0 && (optionA || optionB || optionC || optionD)) {
    const letterOptions: [string, string | undefined][] = [
      ['A', optionA],
      ['B', optionB],
      ['C', optionC],
      ['D', optionD],
    ];
    for (const [letter, val] of letterOptions) {
      if (val === undefined) continue;
      options.push({ id: letter, labelHtml: val });
    }
  }

  if (options.length === 0) {
    ['A', 'B', 'C', 'D'].forEach((letter, idx) => {
      options.push({ id: letter, labelHtml: `<p>${letter}</p>` });
    });
  }

  const correctRaw =
    obj.correct_option_id ??
    obj.correctOptionId ??
    obj.answer ??
    obj.correct ??
    obj.solution;

  let correctOptionId = pickString(correctRaw) ?? options[0]?.id ?? 'A';
  correctOptionId = normalizeAnswerKey(correctOptionId);

  if (!options.some((o) => o.id === correctOptionId)) {
    correctOptionId = options[0]?.id ?? correctOptionId;
  }

  const explanationHtml =
    pickString(obj.explanation_html) ??
    pickString(obj.explanationHtml) ??
    pickString(obj.solution_html) ??
    pickString(obj.rationale_html);

  return {
    id,
    examType,
    subject,
    year,
    promptHtml,
    options,
    correctOptionId,
    explanationHtml,
    orderIndex: fallbacks.orderIndex,
    source: obj,
  };
}

export function normalizeQuestionList(
  raw: unknown,
  examType: PracticeExamType,
  defaults: { subject: string; year: number }
): NormalizedQuestion[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else {
    const obj = asRecord(raw);
    if (!obj) {
      list = [];
    } else {
      const nested =
        obj.results ??
        obj.items ??
        obj.questions ??
        obj.data ??
        obj.payload;
      if (Array.isArray(nested)) {
        list = nested;
      } else if (asRecord(nested)) {
        /** ALOC (and similar): one question per response in `data`: { id, question, option, … } */
        list = [nested];
      }
    }
  }
  const out: NormalizedQuestion[] = [];
  list.forEach((item, idx) => {
    const q = normalizeQuestionPayload(item, examType, {
      subject: defaults.subject,
      year: defaults.year,
      orderIndex: idx,
    });
    if (q) out.push(q);
  });
  return out;
}
