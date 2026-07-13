import { apiRequest } from '@/services/api';
import type { NormalizedQuestion } from '@/src/types/practice';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export function plainTextFromPracticeHtml(html: string): string {
  if (!html?.trim()) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMockPracticeExplanation(html: string): boolean {
  return /mock explanation text for local ui testing/i.test(plainTextFromPracticeHtml(html));
}

export function hasBundledExplanation(q: NormalizedQuestion): boolean {
  const html = q.explanationHtml ?? '';
  if (!plainTextFromPracticeHtml(html)) return false;
  if (isMockPracticeExplanation(html)) return false;
  return true;
}

export type ExplainAnswerInput = {
  examType: string;
  subject: string;
  year: number;
  question: NormalizedQuestion;
};

function questionToBackendPayload(q: NormalizedQuestion): Record<string, unknown> {
  return {
    id: q.id,
    exam_type: q.examType,
    subject: q.subject,
    year: q.year,
    prompt_html: q.promptHtml,
    options: q.options.map((o) => ({ id: o.id, label_html: o.labelHtml })),
    correct_option_id: q.correctOptionId,
    explanation_html: q.explanationHtml ?? '',
    order_index: q.orderIndex,
  };
}

async function fetchAiAnswerExplanationFromBackend(
  input: ExplainAnswerInput,
  opts?: { signal?: AbortSignal }
): Promise<string> {
  const response = await apiRequest('/v1/practice/explain/', {
    method: 'POST',
    signal: opts?.signal,
    body: JSON.stringify({
      exam_type: input.examType,
      subject: input.subject,
      year: input.year,
      question: questionToBackendPayload(input.question),
    }),
  });
  const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const err =
      raw && typeof raw.error === 'string'
        ? raw.error
        : `SmartShelf explain API failed (${response.status})`;
    throw new Error(err);
  }
  const text = typeof raw?.explanation === 'string' ? raw.explanation.trim() : '';
  if (!text) {
    throw new Error('No explanation text returned from SmartShelf.');
  }
  return text;
}

/**
 * Short tutor-style explanation. Uses SmartShelf backend (OpenAI proxy) when signed in;
 * falls back to EXPO_PUBLIC_OPENAI_API_KEY in local dev only.
 */
export async function fetchAiAnswerExplanation(
  input: ExplainAnswerInput,
  opts?: { signal?: AbortSignal }
): Promise<string> {
  try {
    return await fetchAiAnswerExplanationFromBackend(input, opts);
  } catch (backendErr) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw backendErr instanceof Error
        ? backendErr
        : new Error(
            'AI explanations require OPENAI_API_KEY on the SmartShelf server (or EXPO_PUBLIC_OPENAI_API_KEY in local dev).'
          );
    }
    if (!__DEV__) {
      throw backendErr instanceof Error
        ? backendErr
        : new Error('AI explanations are unavailable. Configure OPENAI_API_KEY on the server.');
    }
  }

  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Add EXPO_PUBLIC_OPENAI_API_KEY to frontend/.env and restart Expo.');
  }

  const model = process.env.EXPO_PUBLIC_OPENAI_EXPLAIN_MODEL?.trim() || 'gpt-4o-mini';
  const promptPlain = plainTextFromPracticeHtml(input.question.promptHtml);
  const optionsPlain = input.question.options.map((o) => ({
    id: o.id,
    text: plainTextFromPracticeHtml(o.labelHtml),
  }));
  const bankHint = plainTextFromPracticeHtml(input.question.explanationHtml ?? '');

  const userBlock = [
    `Exam: ${input.examType}`,
    `Subject: ${input.subject}`,
    `Year: ${input.year}`,
    '',
    'Question:',
    promptPlain,
    '',
    'Options:',
    ...optionsPlain.map((o) => `${o.id}) ${o.text}`),
    '',
    `Correct option (verified): ${input.question.correctOptionId}`,
    bankHint ? `\nOfficial / bundled solution (may be empty or partial): ${bankHint}` : '',
    '',
    'Write 3–6 short sentences explaining why the correct option is right. Be clear and exam-appropriate. Do not restate only the letter—justify the concept. If LaTeX appears, use plain words.',
  ].join('\n');

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    signal: opts?.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 450,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful exam tutor. Answer concisely in plain text (no markdown headings). No unsupported claims.',
        },
        { role: 'user', content: userBlock },
      ],
    }),
  });

  const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const err =
      raw && typeof raw.error === 'object' && raw.error && 'message' in raw.error
        ? String((raw.error as { message?: string }).message)
        : `OpenAI request failed (${response.status})`;
    throw new Error(err);
  }

  const choices = raw?.choices;
  const first =
    Array.isArray(choices) && choices[0] && typeof choices[0] === 'object'
      ? (choices[0] as { message?: { content?: string } })
      : null;
  const text = first?.message?.content?.trim();
  if (!text) {
    throw new Error('No explanation text returned from the model.');
  }
  return text;
}
