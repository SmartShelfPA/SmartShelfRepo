/**
 * Study-agent IGCSE catalog — SmartShelf Django `/api/igcse/*` only.
 * No live Open IGCSE / webity integration.
 */
import { API_BASE_URL, getApiExtraHeaders, getToken } from '@/services/api';
import type {
  IgcseCatalogChapter,
  IgcseCatalogSubject,
  IgcseGeneratedSetDetail,
  IgcseGeneratedSetSummary,
} from '@/src/types/igcseCatalog';

const IG_TIMEOUT_MS = 20000;

type EnvelopeErrorBody = {
  success?: false;
  error?: { message?: string; detail?: string; code?: string };
};

function canonicalEnvelopeApiRoot(): string {
  let root = API_BASE_URL.replace(/\/+$/, '');
  root = root.replace(/\/api\/v\d+$/i, '/api');
  if (!/\/api$/i.test(root)) {
    if (!root.toLowerCase().includes('/api')) {
      root = `${root}/api`;
    }
  }
  return root.replace(/\/+$/, '');
}

function messageFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Request failed';
  const o = body as Record<string, unknown>;
  if (o.success === false && o.error && typeof o.error === 'object') {
    const e = o.error as { message?: unknown; detail?: unknown };
    const msg = typeof e.message === 'string' ? e.message : '';
    const detail = typeof e.detail === 'string' ? e.detail : '';
    return [msg, detail].filter(Boolean).join(' — ') || 'Request failed';
  }
  return 'Request failed';
}

async function envelopeGet<T>(path: string): Promise<T> {
  const root = canonicalEnvelopeApiRoot();
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${root}${p}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IG_TIMEOUT_MS);
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getApiExtraHeaders(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    const msg = e instanceof Error ? e.message : String(e);
    if (name === 'AbortError' || /abort/i.test(msg)) {
      throw new Error(
        'Request timed out. Check EXPO_PUBLIC_API_BASE_URL and that Django is reachable.'
      );
    }
    throw new Error(msg || 'Network error');
  } finally {
    clearTimeout(timeout);
  }

  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(messageFromBody(body));
  if (!body || typeof body !== 'object') throw new Error('Invalid JSON');

  const env = body as EnvelopeErrorBody & { success?: boolean; data?: T };
  if (!env.success || env.data === undefined || env.data === null) {
    throw new Error(messageFromBody(body));
  }
  return env.data;
}

function mapSubject(raw: Record<string, unknown>): IgcseCatalogSubject | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  return { id, title: typeof raw.title === 'string' ? raw.title : id };
}

function mapChapter(raw: Record<string, unknown>): IgcseCatalogChapter | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  return { id, title: typeof raw.title === 'string' ? raw.title : id };
}

function mapSetSummary(raw: Record<string, unknown>): IgcseGeneratedSetSummary | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  return {
    id,
    subject_slug: String(raw.subject_slug ?? ''),
    chapter_slug: String(raw.chapter_slug ?? ''),
    chapter_title: String(raw.chapter_title ?? ''),
    practice_paper_url: String(raw.practice_paper_url ?? ''),
    worked_solutions_url: String(raw.worked_solutions_url ?? ''),
    simulator_set_id: String(raw.simulator_set_id ?? ''),
    simulator_public_url: String(raw.simulator_public_url ?? ''),
    simulator_artifact_url:
      typeof raw.simulator_artifact_url === 'string' ? raw.simulator_artifact_url : undefined,
    generated_at: String(raw.generated_at ?? ''),
    is_published: Boolean(raw.is_published),
    generation_status: String(raw.generation_status ?? ''),
    quality_score:
      typeof raw.quality_score === 'number' && Number.isFinite(raw.quality_score)
        ? raw.quality_score
        : null,
    pipeline_bundle_id:
      typeof raw.pipeline_bundle_id === 'string' ? raw.pipeline_bundle_id : null,
    version: typeof raw.version === 'number' ? raw.version : 1,
    is_latest_published: Boolean(raw.is_latest_published),
  };
}

function mapPdfAsset(raw: unknown): IgcseGeneratedSetDetail['practice_paper'] {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url : '';
  if (!url) return null;
  return {
    url,
    sha256: typeof o.sha256 === 'string' ? o.sha256 : null,
    page_count: typeof o.page_count === 'number' ? o.page_count : null,
  };
}

function mapSimulator(raw: unknown): IgcseGeneratedSetDetail['simulator'] {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const simulator_set_id = typeof o.simulator_set_id === 'string' ? o.simulator_set_id : '';
  if (!simulator_set_id) return null;
  return {
    simulator_set_id,
    public_url: typeof o.public_url === 'string' ? o.public_url : '',
    artifact_url: typeof o.artifact_url === 'string' ? o.artifact_url : undefined,
    artifact_json:
      o.artifact_json && typeof o.artifact_json === 'object'
        ? (o.artifact_json as Record<string, unknown>)
        : undefined,
    schema_version: typeof o.schema_version === 'string' ? o.schema_version : undefined,
    build_id: typeof o.build_id === 'string' ? o.build_id : undefined,
  };
}

function mapSetDetail(raw: Record<string, unknown>): IgcseGeneratedSetDetail | null {
  const base = mapSetSummary(raw);
  if (!base) return null;
  return {
    ...base,
    generation_metadata:
      raw.generation_metadata && typeof raw.generation_metadata === 'object'
        ? (raw.generation_metadata as Record<string, unknown>)
        : {},
    practice_paper: mapPdfAsset(raw.practice_paper),
    worked_solutions: mapPdfAsset(raw.worked_solutions),
    simulator: mapSimulator(raw.simulator),
  };
}

export async function fetchIgcsSubjects(): Promise<IgcseCatalogSubject[]> {
  const data = await envelopeGet<{ subjects?: unknown[] }>('/igcse/subjects/');
  const list = data.subjects;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) =>
      item && typeof item === 'object' ? mapSubject(item as Record<string, unknown>) : null
    )
    .filter((x): x is IgcseCatalogSubject => x !== null);
}

export async function fetchIgcsChapters(subjectSlug: string): Promise<IgcseCatalogChapter[]> {
  const qs = new URLSearchParams({ subject: subjectSlug.trim().toLowerCase() });
  const data = await envelopeGet<{ chapters?: unknown[] }>(`/igcse/chapters/?${qs}`);
  const list = data.chapters;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) =>
      item && typeof item === 'object' ? mapChapter(item as Record<string, unknown>) : null
    )
    .filter((x): x is IgcseCatalogChapter => x !== null);
}

export async function fetchIgcsSetsForChapter(
  subjectSlug: string,
  chapterSlug: string
): Promise<IgcseGeneratedSetSummary[]> {
  const qs = new URLSearchParams({
    subject: subjectSlug.trim().toLowerCase(),
    chapter: chapterSlug.trim().toLowerCase(),
  });
  const data = await envelopeGet<{ sets?: unknown[] }>(`/igcse/sets/?${qs}`);
  const list = data.sets;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) =>
      item && typeof item === 'object' ? mapSetSummary(item as Record<string, unknown>) : null
    )
    .filter((x): x is IgcseGeneratedSetSummary => x !== null);
}

export async function fetchIgcsSetDetail(setId: string): Promise<IgcseGeneratedSetDetail> {
  const data = await envelopeGet<{ set?: Record<string, unknown> }>(
    `/igcse/sets/${encodeURIComponent(setId)}/`
  );
  const raw = data.set;
  if (!raw || typeof raw !== 'object') throw new Error('Set detail missing from response');
  const mapped = mapSetDetail(raw);
  if (!mapped) throw new Error('Invalid set detail payload');
  return mapped;
}

/** Prefer latest published set, else first returned. */
export function pickPrimarySet(sets: IgcseGeneratedSetSummary[]): IgcseGeneratedSetSummary | null {
  if (sets.length === 0) return null;
  const latest = sets.find((s) => s.is_latest_published);
  return latest ?? sets[0];
}
