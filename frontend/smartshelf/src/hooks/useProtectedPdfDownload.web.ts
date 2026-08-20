import { useCallback, useEffect, useRef, useState } from 'react';

import {
  authorizeDownload,
  ProtectedPdfError,
  type ProtectedPdfAsset,
} from '@/src/api/protectedPdfs';
import {
  getDownload,
  isOfflineExpired,
  pdfBlobExists,
  removeDownload,
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
        setStatus('idle');
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

      const response = await fetch(auth.download_url);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status}).`);
      }
      const blob = await response.blob();
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

      if (mounted.current) setStatus('done');
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ProtectedPdfError && (e.code === 'access_denied' || e.code === 'revoked')) {
        setError(e.message);
        setStatus('revoked');
        return;
      }
      setError(e instanceof Error ? e.message : 'Download failed.');
      setStatus('failed');
    }
  }, [asset.id, asset.title, asset.subject]);

  const remove = useCallback(async () => {
    await removeDownload(asset.id);
    if (mounted.current) {
      setStatus('idle');
      setError(null);
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

  return { status, error, download, remove, prepareOpen };
}
