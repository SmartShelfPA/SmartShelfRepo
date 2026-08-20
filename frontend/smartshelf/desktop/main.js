/**
 * Electron main process — loads Expo web (dev server or exported dist).
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { registerDownloadIpc } = require('./downloadsStore');

const isDev = !app.isPackaged;
const DEV_URL = process.env.SMARTSHELF_DEV_URL || 'http://localhost:8081';
const BOUNDS_FILE = () => path.join(app.getPath('userData'), 'window-bounds.json');

function readBounds() {
  try {
    const parsed = JSON.parse(fs.readFileSync(BOUNDS_FILE(), 'utf8'));
    if (parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return parsed;
    }
  } catch {
    // first launch
  }
  return { width: 1280, height: 820 };
}

function saveBounds(win) {
  if (!win || win.isDestroyed()) return;
  try {
    fs.writeFileSync(BOUNDS_FILE(), JSON.stringify(win.getBounds()));
  } catch {
    // ignore
  }
}

/** Serve static Expo web export so client-side routing works (not file://). */
function createStaticServer(rootDir) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json',
  };

  return http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let filePath = path.join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(rootDir, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err && err.message ? err.message : err));
    }
  });
}

function resolveDistDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'web-dist');
  }
  return path.join(__dirname, '..', 'dist');
}

function resolveAppIcon() {
  const packaged = path.join(process.resourcesPath, 'build', 'icon.png');
  const local = path.join(__dirname, 'build', 'icon.png');
  if (fs.existsSync(packaged)) return packaged;
  if (fs.existsSync(local)) return local;
  return undefined;
}

async function createWindow() {
  const bounds = readBounds();
  const icon = resolveAppIcon();
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    ...(typeof bounds.x === 'number' && typeof bounds.y === 'number' ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 900,
    minHeight: 640,
    title: 'SmartShelf',
    backgroundColor: '#000000',
    icon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveBounds(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await win.loadURL(DEV_URL);
    return;
  }

  const distDir = resolveDistDir();
  const server = createStaticServer(distDir);
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const { port } = server.address();
  await win.loadURL(`http://127.0.0.1:${port}/`);

  app.on('will-quit', () => {
    try {
      server.close();
    } catch {
      // ignore
    }
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('ca.com.smartshelf.desktop');
  }
  registerDownloadIpc();
  void createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
