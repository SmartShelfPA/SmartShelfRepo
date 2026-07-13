import { File } from 'expo-file-system';

import { authorizeDownload, ProtectedPdfError } from '@/src/api/protectedPdfs';
import {
  getDownload,
  isOfflineExpired,
  removeDownload,
  upsertDownload,
} from '@/src/lib/secureDownloadStore';

export type PrepareOpenResult =
  | { ok: true; localUri: string }
  | {
      ok: false;
      reason: 'not_downloaded' | 'stale' | 'revoked' | 'expired_offline';
      message: string;
    };

/**
 * Validate that a downloaded protected PDF may be opened from its app-private
 * local copy. Within the offline window the local file opens directly; once
 * the window lapses the backend is re-checked so revoked / changed content is
 * blocked (and stale copies are deleted).
 */
export async function prepareProtectedOpen(assetId: string): Promise<PrepareOpenResult> {
  const record = await getDownload(assetId);
  if (!record) {
    return { ok: false, reason: 'not_downloaded', message: 'Download this resource first.' };
  }

  const file = new File(record.localUri);
  if (!file.exists) {
    await removeDownload(assetId);
    return { ok: false, reason: 'not_downloaded', message: 'Local copy missing — download again.' };
  }

  if (!isOfflineExpired(record)) {
    return { ok: true, localUri: record.localUri };
  }

  try {
    const auth = await authorizeDownload(assetId);
    if (auth.rights_version !== record.rightsVersion) {
      try {
        if (file.exists) file.delete();
      } catch {
        /* ignore */
      }
      await removeDownload(assetId);
      return { ok: false, reason: 'stale', message: 'A newer version is available. Please download again.' };
    }
    await upsertDownload({
      ...record,
      offlineExpiresAt: auth.offline_access_expires_at,
      rightsVersion: auth.rights_version,
      lastToken: auth.token,
    });
    return { ok: true, localUri: record.localUri };
  } catch (e) {
    if (e instanceof ProtectedPdfError && (e.code === 'access_denied' || e.code === 'revoked')) {
      try {
        if (file.exists) file.delete();
      } catch {
        /* ignore */
      }
      await removeDownload(assetId);
      return { ok: false, reason: 'revoked', message: 'Access to this resource has been revoked.' };
    }
    return {
      ok: false,
      reason: 'expired_offline',
      message: 'Reconnect to the internet to refresh offline access.',
    };
  }
}
