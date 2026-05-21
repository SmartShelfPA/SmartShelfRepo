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

export function hasBundledExplanation(q: NormalizedQuestion): boolean {
  return plainTextFromPracticeHtml(q.explanationHtml ?? '').length > 0;
}

export type ExplainAnswerInput = {
  examType: string;
  subject: string;
  year: number;
  question: NormalizedQuestion;
};

/**
 * Short tutor-style explanation (OpenAI). Requires `EXPO_PUBLIC_OPENAI_API_KEY` in `.env`.
 * For production, prefer a backend proxy so the key is not in the client bundle.
 */
export async function fetchAiAnswerExplanation(
  input: ExplainAnswerInput,
  opts?: { signal?: AbortSignal }
): Promise<string> {
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
