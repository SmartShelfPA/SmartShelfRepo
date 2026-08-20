/**
 * Preload bridge — desktop flag + licensed PDF storage APIs.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smartshelfDesktop', {
  isDesktop: true,
  platform: process.platform,
  downloads: {
    list: () => ipcRenderer.invoke('downloads:list'),
    get: (assetId) => ipcRenderer.invoke('downloads:get', assetId),
    exists: (assetId) => ipcRenderer.invoke('downloads:exists', assetId),
    save: (record, bytes) => ipcRenderer.invoke('downloads:save', record, bytes),
    upsertMeta: (record) => ipcRenderer.invoke('downloads:upsertMeta', record),
    read: (assetId) => ipcRenderer.invoke('downloads:read', assetId),
    remove: (assetId) => ipcRenderer.invoke('downloads:remove', assetId),
  },
});
