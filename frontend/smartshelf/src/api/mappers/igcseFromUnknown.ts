import { resolveMediaUrl } from '@/src/api/resolveMediaUrl';
import type { IgcsTextbook } from '@/src/types/igcse';

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

export function normalizeIgcsTextbook(raw: unknown, index: number): IgcsTextbook | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const id =
    pickString(obj.id) ??
    pickString(obj.book_id) ??
    pickString(obj.slug) ??
    `igcse-book-${index}`;

  const title = pickString(obj.title) ?? pickString(obj.name) ?? 'Untitled textbook';
  const subject =
    pickString(obj.subject) ??
    pickString(obj.course) ??
    pickString(obj.category) ??
    'General';

  const epubUrl = resolveMediaUrl(
    pickString(obj.epub_url) ??
      pickString(obj.epubUrl) ??
      pickString(obj.asset_url) ??
      pickString(obj.url)
  );

  if (!epubUrl) return null;

  const progressPercent =
    pickNumber(obj.progress_percent) ??
    pickNumber(obj.progressPercent) ??
    pickNumber(obj.percent_read);

  const lastReadAt =
    pickString(obj.last_read_at) ?? pickString(obj.lastReadAt) ?? pickString(obj.updated_at);

  return {
    id,
    title,
    subject,
    author: pickString(obj.author) ?? pickString(obj.authors),
    coverImageUrl: resolveMediaUrl(
      pickString(obj.cover_image_url) ?? pickString(obj.coverImageUrl)
    ),
    description: pickString(obj.description) ?? pickString(obj.summary),
    epubUrl,
    progressPercent,
    lastReadAt,
  };
}

export function normalizeIgcsTextbookList(raw: unknown): IgcsTextbook[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else {
    const obj = asRecord(raw);
    const nested = obj?.results ?? obj?.items ?? obj?.books ?? obj?.data;
    if (Array.isArray(nested)) list = nested;
  }
  const out: IgcsTextbook[] = [];
  list.forEach((item, idx) => {
    const b = normalizeIgcsTextbook(item, idx);
    if (b) out.push(b);
  });
  return out;
}
