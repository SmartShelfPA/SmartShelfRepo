/**
 * GitHub Releases auto-update (electron-updater).
 * Only runs in packaged builds — skipped during desktop:dev.
 */
const { app, dialog } = require('electron');

function setupAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.warn('[auto-update] electron-updater not available:', err.message);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.warn('[auto-update]', err && err.message ? err.message : err);
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[auto-update] downloading', info && info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    const version = (info && info.version) || 'a new version';
    dialog
      .showMessageBox({
        type: 'info',
        title: 'SmartShelf update ready',
        message: `SmartShelf ${version} has been downloaded.`,
        detail: 'Restart now to install the update, or choose Later to install when you quit.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      })
      .catch(() => {
        // ignore dialog failures
      });
  });

  // Delay so the main window can finish loading first.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[auto-update] check failed:', err && err.message ? err.message : err);
    });
  }, 8000);
}

module.exports = { setupAutoUpdater };
