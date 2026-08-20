export type EpubReaderOutboundMessage =
  | { type: 'debug'; message: string }
  | { type: 'ready' }
  | {
      type: 'relocated';
      fraction: number;
      startCfi?: string;
      endCfi?: string;
      chapterHref?: string;
    }
  | { type: 'toc'; toc: unknown }
  | { type: 'error'; message: string };

export type EpubReaderHandle = {
  send: (msg: Record<string, unknown>) => void;
};
