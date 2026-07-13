import { apiRequest } from '@/services/api';

export type ProtectedPdfAsset = {
  id: string;
  title: string;
  subject?: string;
  chapter?: string;
  description?: string;
  cover_image_url?: string;
  file_size_bytes: number;
  access_level: string;
  rights_status: string;
  rights_version: number;
  is_downloadable: boolean;
  created_at: string;
  updated_at: string;
};

export type DownloadAuthorization = {
  asset_id: string;
  title: string;
  download_url: string;
  token: string;
  expires_in: number;
  expires_at: string;
  offline_access_expires_at: string;
  rights_version: number;
  file_size_bytes: number;
};

export class ProtectedPdfError extends Error {
  readonly code?: string;
  readonly status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ProtectedPdfError';
    this.code = code;
    this.status = status;
  }
}

function parseList(raw: unknown): ProtectedPdfAsset[] {
  if (Array.isArray(raw)) return raw as ProtectedPdfAsset[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).results)) {
    return (raw as any).results as ProtectedPdfAsset[];
  }
  return [];
}

export async function listProtectedPdfs(): Promise<ProtectedPdfAsset[]> {
  const res = await apiRequest('/v1/igcse/pdfs/', { method: 'GET' });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ProtectedPdfError(
      'Could not load protected resources.',
      undefined,
      res.status
    );
  }
  return parseList(raw);
}

export async function getProtectedPdf(id: string): Promise<ProtectedPdfAsset | null> {
  const res = await apiRequest(`/v1/igcse/pdfs/${encodeURIComponent(id)}/`, {
    method: 'GET',
  });
  if (res.status === 404) return null;
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ProtectedPdfError('Could not load resource.', undefined, res.status);
  }
  return raw as ProtectedPdfAsset;
}

/**
 * Ask the backend to authorize a download. The backend re-checks rights and
 * returns a short-lived signed URL + metadata. Throws ProtectedPdfError with a
 * `code` ('access_denied' | 'revoked' | ...) when access is refused.
 */
export async function authorizeDownload(id: string): Promise<DownloadAuthorization> {
  const res = await apiRequest(
    `/v1/igcse/pdfs/${encodeURIComponent(id)}/authorize-download/`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const code = (raw && (raw.code as string)) || undefined;
    const msg =
      (raw && (raw.error as string)) || 'Download authorization was refused.';
    throw new ProtectedPdfError(msg, code, res.status);
  }
  return raw as DownloadAuthorization;
}
