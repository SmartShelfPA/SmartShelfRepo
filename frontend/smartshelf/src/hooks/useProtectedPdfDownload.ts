import { useCallback, useEffect, useRef, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';

import {
  authorizeDownload,
  ProtectedPdfError,
  type ProtectedPdfAsset,
} from '@/src/api/protectedPdfs';
import {
  getDownload,
  isOfflineExpired,
  removeDownload,
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

const DIR_NAME = 'protected_pdfs';

function downloadsDir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function fileForAsset(assetId: string): File {
  return new File(downloadsDir(), `${assetId.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`);
}

export function useProtectedPdfDownload(asset: Pick<ProtectedPdfAsset, 'id' | 'title' | 'subject' | 'rights_version' | 'file_size_bytes'>) {
  const [status, setStatus] = useState<ProtectedDownloadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Hydrate state from the secure index on mount.
  useEffect(() => {
    let active = true;
    void (async () => {
      const record = await getDownload(asset.id);
      if (!active || !mounted.current) return;
      if (!record) {
        setStatus('idle');
        return;
      }
      const file = new File(record.localUri);
      if (!file.exists) {
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

      const dir = downloadsDir();
      if (!dir.exists) {
        dir.create({ intermediates: true, idempotent: true });
      }
      const dest = fileForAsset(asset.id);
      if (dest.exists) dest.delete();

      // The download_url carries the short-lived signed token. The signature
      // is the authorization, so no auth header is required for this stream.
      const downloaded = await File.downloadFileAsync(auth.download_url, dest);

      if (!downloaded.exists || (downloaded.size ?? 0) <= 0) {
        throw new Error('Downloaded file was empty.');
      }

      const record: ProtectedDownloadRecord = {
        assetId: asset.id,
        title: asset.title,
        subject: asset.subject,
        localUri: downloaded.uri,
        fileSizeBytes: downloaded.size ?? auth.file_size_bytes,
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
    try {
      const file = fileForAsset(asset.id);
      if (file.exists) file.delete();
    } catch {
      // ignore
    }
    await removeDownload(asset.id);
    if (mounted.current) {
      setStatus('idle');
      setError(null);
    }
  }, [asset.id]);

  /**
   * Validate that the local copy can be opened. Re-authorizes online once the
   * offline window lapses so revoked / rights-changed content is blocked.
   */
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
