import { authorizeDownload, ProtectedPdfError } from '@/src/api/protectedPdfs';
import {
  getDownload,
  getPdfBlobUrl,
  isOfflineExpired,
  pdfBlobExists,
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

export async function prepareProtectedOpen(assetId: string): Promise<PrepareOpenResult> {
  const record = await getDownload(assetId);
  if (!record) {
    return { ok: false, reason: 'not_downloaded', message: 'Download this resource first.' };
  }

  const exists = await pdfBlobExists(assetId);
  if (!exists) {
    await removeDownload(assetId);
    return { ok: false, reason: 'not_downloaded', message: 'Local copy missing — download again.' };
  }

  const blobUrl = await getPdfBlobUrl(assetId);
  if (!blobUrl) {
    await removeDownload(assetId);
    return { ok: false, reason: 'not_downloaded', message: 'Local copy missing — download again.' };
  }

  if (!isOfflineExpired(record)) {
    return { ok: true, localUri: blobUrl };
  }

  try {
    const auth = await authorizeDownload(assetId);
    if (auth.rights_version !== record.rightsVersion) {
      await removeDownload(assetId);
      return { ok: false, reason: 'stale', message: 'A newer version is available. Please download again.' };
    }
    await upsertDownload({
      ...record,
      localUri: blobUrl,
      offlineExpiresAt: auth.offline_access_expires_at,
      rightsVersion: auth.rights_version,
      lastToken: auth.token,
    });
    return { ok: true, localUri: blobUrl };
  } catch (e) {
    if (e instanceof ProtectedPdfError && (e.code === 'access_denied' || e.code === 'revoked')) {
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
