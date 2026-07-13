import { Directory, File, Paths } from 'expo-file-system';

/**
 * App-private index of protected PDF downloads.
 *
 * Sensitive download-authorization metadata (offline access expiry, rights
 * version, local file pointer) is stored in a JSON file inside the app's
 * document directory — NOT in AsyncStorage and NOT in user-visible shared
 * folders. This avoids requiring the ExpoSecureStore native module, which
 * is only available after a dev-client rebuild that includes expo-secure-store.
 *
 * PDF bytes live alongside this index under ``protected_pdfs/``.
 */

const INDEX_FILENAME = '.downloads-index.json';

function downloadsDir(): Directory {
  return new Directory(Paths.document, 'protected_pdfs');
}

function indexFile(): File {
  return new File(downloadsDir(), INDEX_FILENAME);
}

export type ProtectedDownloadRecord = {
  assetId: string;
  title: string;
  subject?: string;
  /** app-private file:// uri of the downloaded PDF */
  localUri: string;
  fileSizeBytes?: number;
  /** ISO — after this the app must re-authorize before opening offline */
  offlineExpiresAt: string;
  /** server rights version captured at download time */
  rightsVersion: number;
  /** last short-lived signed download token (expires quickly; best-effort) */
  lastToken?: string;
  downloadedAt: string;
};

type IndexMap = Record<string, ProtectedDownloadRecord>;

function ensureDir(): void {
  const dir = downloadsDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

function readIndexSync(): IndexMap {
  const file = indexFile();
  if (!file.exists) return {};
  try {
    const raw = file.textSync();
    const parsed = JSON.parse(raw) as IndexMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeIndexSync(map: IndexMap): void {
  ensureDir();
  const file = indexFile();
  file.write(JSON.stringify(map));
}

async function readIndex(): Promise<IndexMap> {
  return readIndexSync();
}

async function writeIndex(map: IndexMap): Promise<void> {
  try {
    writeIndexSync(map);
  } catch {
    // fail closed — do not persist a broken index
  }
}

export async function getAllDownloads(): Promise<ProtectedDownloadRecord[]> {
  const map = await readIndex();
  return Object.values(map).sort((a, b) =>
    (b.downloadedAt || '').localeCompare(a.downloadedAt || '')
  );
}

export async function getDownload(
  assetId: string
): Promise<ProtectedDownloadRecord | null> {
  const map = await readIndex();
  return map[assetId] ?? null;
}

export async function upsertDownload(record: ProtectedDownloadRecord): Promise<void> {
  const map = await readIndex();
  map[record.assetId] = record;
  await writeIndex(map);
}

export async function removeDownload(assetId: string): Promise<void> {
  const map = await readIndex();
  delete map[assetId];
  await writeIndex(map);
}

/** True when the offline access window has lapsed and re-authorization is required. */
export function isOfflineExpired(record: ProtectedDownloadRecord, now = Date.now()): boolean {
  const ts = Date.parse(record.offlineExpiresAt);
  return Number.isFinite(ts) ? ts < now : true;
}
