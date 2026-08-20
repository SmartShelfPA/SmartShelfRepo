/**
 * Electron-native storage for licensed PDFs.
 * Files live in userData/protected_pdfs — not IndexedDB, not a public Downloads folder.
 */
const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');

function downloadsDir() {
  const dir = path.join(app.getPath('userData'), 'protected_pdfs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeId(id) {
  return String(id || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function pdfPath(assetId) {
  return path.join(downloadsDir(), `${safeId(assetId)}.pdf`);
}

function indexPath() {
  return path.join(downloadsDir(), 'index.json');
}

function readIndex() {
  try {
    const raw = fs.readFileSync(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeIndex(map) {
  fs.writeFileSync(indexPath(), JSON.stringify(map));
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error('Invalid file payload');
}

function registerDownloadIpc() {
  ipcMain.handle('downloads:list', async () => {
    const map = readIndex();
    return Object.values(map).sort((a, b) =>
      String(b.downloadedAt || '').localeCompare(String(a.downloadedAt || ''))
    );
  });

  ipcMain.handle('downloads:get', async (_event, assetId) => {
    const map = readIndex();
    return map[assetId] ?? null;
  });

  ipcMain.handle('downloads:exists', async (_event, assetId) => {
    try {
      return fs.existsSync(pdfPath(assetId));
    } catch {
      return false;
    }
  });

  ipcMain.handle('downloads:save', async (_event, record, bytes) => {
    if (!record || !record.assetId) {
      throw new Error('Missing download record');
    }
    const dest = pdfPath(record.assetId);
    fs.writeFileSync(dest, toBuffer(bytes));
    const map = readIndex();
    map[record.assetId] = {
      ...record,
      localUri: dest,
      fileSizeBytes: record.fileSizeBytes || fs.statSync(dest).size,
    };
    writeIndex(map);
    return map[record.assetId];
  });

  ipcMain.handle('downloads:upsertMeta', async (_event, record) => {
    if (!record || !record.assetId) {
      throw new Error('Missing download record');
    }
    const dest = pdfPath(record.assetId);
    const map = readIndex();
    map[record.assetId] = {
      ...map[record.assetId],
      ...record,
      localUri: fs.existsSync(dest) ? dest : record.localUri,
    };
    writeIndex(map);
    return map[record.assetId];
  });

  ipcMain.handle('downloads:read', async (_event, assetId) => {
    const dest = pdfPath(assetId);
    if (!fs.existsSync(dest)) return null;
    const buf = fs.readFileSync(dest);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });

  ipcMain.handle('downloads:remove', async (_event, assetId) => {
    const map = readIndex();
    delete map[assetId];
    writeIndex(map);
    const dest = pdfPath(assetId);
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      // ignore missing file
    }
    return true;
  });
}

module.exports = { registerDownloadIpc, downloadsDir };
