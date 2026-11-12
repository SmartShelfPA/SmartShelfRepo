import { useCallback, useEffect, useRef, useState } from 'react';

import {
  authorizeDownload,
  ProtectedPdfError,
  type ProtectedPdfAsset,
} from '@/src/api/protectedPdfs';
import {
  clearPartialPdf,
  getDownload,
  isOfflineExpired,
  pdfBlobExists,
  readPartialPdf,
  removeDownload,
  savePartialPdf,
  storePdfBlob,
  upsertDownload,
  type ProtectedDownloadRecord,
} from '@/src/lib/secureDownloadStore';
import { prepareProtectedOpen, type PrepareOpenResult } from '@/src/lib/protectedPdfAccess';

export type ProtectedDownloadStatus =
  | 'idle'
  | 'authorizing'
  | 'downloading'
  | 'done'
  | 'failed'
  | 'expired'
  | 'revoked';

export type { PrepareOpenResult };

export function useProtectedPdfDownload(
  asset: Pick<ProtectedPdfAsset, 'id' | 'title' | 'subject' | 'rights_version' | 'file_size_bytes'>
) {
  const [status, setStatus] = useState<ProtectedDownloadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const record = await getDownload(asset.id);
      if (!active || !mounted.current) return;
      if (!record) {
        const partial = await readPartialPdf(asset.id);
        if (active && mounted.current) {
          setStatus(partial ? 'failed' : 'idle');
          setError(partial ? 'Download paused. Tap to resume.' : null);
        }
        return;
      }
      const exists = await pdfBlobExists(asset.id);
      if (!exists) {
        await removeDownload(asset.id);
        if (active && mounted.current) setStatus('idle');
        return;
      }
      setStatus(isOfflineExpired(record) ? 'expired' : 'done');
    })();
    return () => {
      active = false;
    };
  }, [asset.id]);

  const download = useCallback(async () => {
    setError(null);
    setStatus('authorizing');
    try {
      const auth = await authorizeDownload(asset.id);
      if (!mounted.current) return;
      setStatus('downloading');
      setProgress(0);
      const blob = await downloadPdfResumable(auth.download_url, asset.id, (ratio) => {
        if (mounted.current) setProgress(ratio);
      });
      if (blob.size <= 0) {
        throw new Error('Downloaded file was empty.');
      }

      const localUri = await storePdfBlob(asset.id, blob);
      const record: ProtectedDownloadRecord = {
        assetId: asset.id,
        title: asset.title,
        subject: asset.subject,
        localUri,
        fileSizeBytes: blob.size ?? auth.file_size_bytes,
        offlineExpiresAt: auth.offline_access_expires_at,
        rightsVersion: auth.rights_version,
        lastToken: auth.token,
        downloadedAt: new Date().toISOString(),
      };
      await upsertDownload(record);

      if (mounted.current) {
        setProgress(null);
        setStatus('done');
      }
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ProtectedPdfError && (e.code === 'access_denied' || e.code === 'revoked')) {
        setError(e.message);
        setStatus('revoked');
        return;
      }
      setError(e instanceof Error ? e.message : 'Download failed.');
      setProgress(null);
      setStatus('failed');
    }
  }, [asset.id, asset.title, asset.subject]);

  const remove = useCallback(async () => {
    await removeDownload(asset.id);
    await clearPartialPdf(asset.id);
    if (mounted.current) {
      setStatus('idle');
      setError(null);
      setProgress(null);
    }
  }, [asset.id]);

  const prepareOpen = useCallback(async (): Promise<PrepareOpenResult> => {
    const result = await prepareProtectedOpen(asset.id);
    if (mounted.current) {
      if (result.ok) setStatus('done');
      else if (result.reason === 'revoked') setStatus('revoked');
      else if (result.reason === 'stale' || result.reason === 'not_downloaded') setStatus('idle');
      else if (result.reason === 'expired_offline') setStatus('expired');
    }
    return result;
  }, [asset.id]);

  return { status, error, progress, download, remove, prepareOpen };
}

async function downloadPdfResumable(
  url: string,
  assetId: string,
  onProgress: (ratio: number) => void
): Promise<Blob> {
  const existing = await readPartialPdf(assetId);
  const have = existing?.size ?? 0;
  const headers: HeadersInit = {};
  if (have > 0) headers.Range = `bytes=${have}-`;

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw new Error('Download interrupted. Tap to resume.');
  }
  if (response.status === 416) {
    await clearPartialPdf(assetId);
    response = await fetch(url);
  } else if (response.status === 200 && have > 0) {
    await clearPartialPdf(assetId);
  }
  if (!response.ok && response.status !== 206) {
    throw new Error(`Download failed (${response.status}).`);
  }

  const prior = response.status === 206 ? existing : null;
  const range = response.headers.get('Content-Range');
  const match = range ? /\/(\d+)\s*$/.exec(range) : null;
  const lengthHeader = Number(response.headers.get('Content-Length') || '0');
  const total = match ? Number(match[1]) : prior ? (prior.size + lengthHeader) : lengthHeader || null;

  const reader = response.body?.getReader();
  if (!reader) {
    const next = await response.blob();
    const blob = prior ? new Blob([prior, next], { type: 'application/pdf' }) : next;
    await clearPartialPdf(assetId);
    onProgress(1);
    return blob;
  }

  const chunks: BlobPart[] = [];
  if (prior) chunks.push(prior);
  let loaded = prior?.size ?? 0;
  let sinceSave = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      sinceSave += value.byteLength;
      if (total) onProgress(Math.min(1, loaded / total));
      if (sinceSave >= 256 * 1024) {
        sinceSave = 0;
        await savePartialPdf(assetId, new Blob(chunks, { type: 'application/pdf' }));
      }
    }
  } catch {
    await savePartialPdf(assetId, new Blob(chunks, { type: 'application/pdf' }));
    throw new Error('Download interrupted. Tap to resume.');
  }

  const blob = new Blob(chunks, { type: 'application/pdf' });
  if (total && blob.size < total) {
    await savePartialPdf(assetId, blob);
    throw new Error('Download interrupted. Tap to resume.');
  }
  await clearPartialPdf(assetId);
  onProgress(1);
  return blob;
}
