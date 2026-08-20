/**
 * Web storage for protected PDFs (IndexedDB).
 * Inside Electron, bytes go to the app userData directory via IPC instead.
 */
import { isElectronDesktop } from '@/src/lib/desktop';
import * as electronStore from '@/src/lib/electronDownloadStore';

const DB_NAME = 'smartshelf-protected-pdfs';
const DB_VERSION = 1;
const STORE_INDEX = 'index';
const STORE_BLOBS = 'blobs';

export type ProtectedDownloadRecord = {
  assetId: string;
  title: string;
  subject?: string;
  /** blob: URL on web; app-private file path on Electron */
  localUri: string;
  fileSizeBytes?: number;
  offlineExpiresAt: string;
  rightsVersion: number;
  lastToken?: string;
  downloadedAt: string;
};

type IndexMap = Record<string, ProtectedDownloadRecord>;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_INDEX)) {
        db.createObjectStore(STORE_INDEX);
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readIndex(): Promise<IndexMap> {
  const map = await idbGet<IndexMap>(STORE_INDEX, 'all');
  return map && typeof map === 'object' ? map : {};
}

async function writeIndex(map: IndexMap): Promise<void> {
  await idbSet(STORE_INDEX, 'all', map);
}

export async function getAllDownloads(): Promise<ProtectedDownloadRecord[]> {
  if (isElectronDesktop()) return electronStore.getAllDownloads();
  const map = await readIndex();
  return Object.values(map).sort((a, b) =>
    (b.downloadedAt || '').localeCompare(a.downloadedAt || '')
  );
}

export async function getDownload(assetId: string): Promise<ProtectedDownloadRecord | null> {
  if (isElectronDesktop()) return electronStore.getDownload(assetId);
  const map = await readIndex();
  return map[assetId] ?? null;
}

export async function upsertDownload(record: ProtectedDownloadRecord): Promise<void> {
  if (isElectronDesktop()) {
    await electronStore.upsertDownload(record);
    return;
  }
  const map = await readIndex();
  map[record.assetId] = record;
  await writeIndex(map);
}

export async function removeDownload(assetId: string): Promise<void> {
  if (isElectronDesktop()) {
    await electronStore.removeDownload(assetId);
    return;
  }
  const map = await readIndex();
  delete map[assetId];
  await writeIndex(map);
  await idbDelete(STORE_BLOBS, assetId);
}

export function isOfflineExpired(record: ProtectedDownloadRecord, now = Date.now()): boolean {
  const ts = Date.parse(record.offlineExpiresAt);
  return Number.isFinite(ts) ? ts < now : true;
}

/** Persist PDF bytes and return a blob: URL for PDF.js. */
export async function storePdfBlob(assetId: string, blob: Blob): Promise<string> {
  if (isElectronDesktop()) return electronStore.storePdfBlob(assetId, blob);
  await idbSet(STORE_BLOBS, assetId, blob);
  return URL.createObjectURL(blob);
}

export async function getPdfBlobUrl(assetId: string): Promise<string | null> {
  if (isElectronDesktop()) return electronStore.getPdfBlobUrl(assetId);
  const blob = await idbGet<Blob>(STORE_BLOBS, assetId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function pdfBlobExists(assetId: string): Promise<boolean> {
  if (isElectronDesktop()) return electronStore.pdfBlobExists(assetId);
  const blob = await idbGet<Blob>(STORE_BLOBS, assetId);
  return Boolean(blob);
}
