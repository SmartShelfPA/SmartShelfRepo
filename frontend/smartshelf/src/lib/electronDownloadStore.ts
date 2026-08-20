import type { DesktopDownloadRecord } from '@/src/types/desktop';

function bridge() {
  const api = typeof window !== 'undefined' ? window.smartshelfDesktop : undefined;
  if (!api?.downloads) {
    throw new Error('Electron download bridge is not available');
  }
  return api.downloads;
}

export async function getAllDownloads(): Promise<DesktopDownloadRecord[]> {
  return bridge().list();
}

export async function getDownload(assetId: string): Promise<DesktopDownloadRecord | null> {
  return bridge().get(assetId);
}

export async function upsertDownload(record: DesktopDownloadRecord): Promise<void> {
  await bridge().upsertMeta(record);
}

export async function removeDownload(assetId: string): Promise<void> {
  await bridge().remove(assetId);
}

export async function storePdfBlob(assetId: string, blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  await bridge().save(
    {
      assetId,
      title: assetId,
      fileSizeBytes: blob.size,
      offlineExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
      rightsVersion: 0,
      downloadedAt: new Date().toISOString(),
    },
    bytes
  );
  return URL.createObjectURL(blob);
}

export async function getPdfBlobUrl(assetId: string): Promise<string | null> {
  const bytes = await bridge().read(assetId);
  if (!bytes || bytes.byteLength <= 0) return null;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function pdfBlobExists(assetId: string): Promise<boolean> {
  return bridge().exists(assetId);
}
