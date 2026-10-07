import { apiRequest } from '@/services/api';
import { readApiError } from '@/src/lib/apiError';

export type AnnotationKind = 'pen' | 'highlight' | 'note';

/** Points are normalised to the page: [0..1 across, 0..1 down]. Width is a fraction of page width. */
export type PdfAnnotation = {
  id: string;
  page: number;
  kind: AnnotationKind;
  color: string;
  width: number;
  points: [number, number][];
  text: string;
  created_at: string;
  updated_at: string;
};

export type NewAnnotation = Pick<PdfAnnotation, 'page' | 'kind' | 'color' | 'width' | 'points'> & {
  text?: string;
};

export const ANNOTATION_COLORS = ['#E53935', '#1E88E5', '#43A047', '#212121', '#FFEB3B'] as const;
export const PEN_WIDTH = 0.004;
export const HIGHLIGHT_WIDTH = 0.022;
export const HIGHLIGHT_OPACITY = 0.35;
export const NOTE_COLOR = '#FFC107';

const base = (assetId: string) => `/v1/igcse/pdfs/${assetId}/annotations/`;

export async function listAnnotations(assetId: string, page?: number): Promise<PdfAnnotation[]> {
  const res = await apiRequest(`${base(assetId)}${page ? `?page=${page}` : ''}`);
  if (!res.ok) throw new Error(await readApiError(res, 'Could not load your notes.'));
  return res.json();
}

export async function createAnnotation(assetId: string, input: NewAnnotation): Promise<PdfAnnotation> {
  const res = await apiRequest(base(assetId), { method: 'POST', body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await readApiError(res, 'Could not save.'));
  return res.json();
}

export async function updateAnnotation(
  assetId: string,
  id: string,
  patch: Partial<Pick<PdfAnnotation, 'text' | 'color'>>
): Promise<PdfAnnotation> {
  const res = await apiRequest(`${base(assetId)}${id}/`, { method: 'PATCH', body: JSON.stringify(patch) });
  if (!res.ok) throw new Error(await readApiError(res, 'Could not save.'));
  return res.json();
}

export async function deleteAnnotation(assetId: string, id: string): Promise<void> {
  const res = await apiRequest(`${base(assetId)}${id}/`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(await readApiError(res, 'Could not delete.'));
}

/** Drops points closer than `minDist` (normalised) to keep strokes small. */
export function simplifyStroke(points: [number, number][], minDist = 0.002): [number, number][] {
  if (points.length <= 2) return points;
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = out[out.length - 1];
    const [x, y] = points[i];
    if (Math.hypot(x - px, y - py) >= minDist) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out.slice(0, 4000);
}

/** Distance from point to segment, used by the eraser. */
function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export function annotationHit(a: PdfAnnotation, p: [number, number], tolerance = 0.015): boolean {
  if (a.kind === 'note') {
    const [nx, ny] = a.points[0] ?? [0, 0];
    return Math.hypot(nx - p[0], ny - p[1]) <= tolerance * 2;
  }
  const tol = tolerance + a.width / 2;
  for (let i = 1; i < a.points.length; i++) {
    if (distToSegment(p, a.points[i - 1], a.points[i]) <= tol) return true;
  }
  return false;
}
