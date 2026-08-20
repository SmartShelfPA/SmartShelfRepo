export type DesktopDownloadRecord = {
  assetId: string;
  title: string;
  subject?: string;
  localUri: string;
  fileSizeBytes?: number;
  offlineExpiresAt: string;
  rightsVersion: number;
  lastToken?: string;
  downloadedAt: string;
};

export type SmartShelfDesktopBridge = {
  isDesktop: true;
  platform: string;
  downloads: {
    list: () => Promise<DesktopDownloadRecord[]>;
    get: (assetId: string) => Promise<DesktopDownloadRecord | null>;
    exists: (assetId: string) => Promise<boolean>;
    save: (
      record: Omit<DesktopDownloadRecord, 'localUri'> & { localUri?: string },
      bytes: ArrayBuffer
    ) => Promise<DesktopDownloadRecord>;
    upsertMeta: (record: DesktopDownloadRecord) => Promise<DesktopDownloadRecord>;
    read: (assetId: string) => Promise<ArrayBuffer | null>;
    remove: (assetId: string) => Promise<boolean>;
  };
};

declare global {
  interface Window {
    smartshelfDesktop?: SmartShelfDesktopBridge;
  }
}

export {};
