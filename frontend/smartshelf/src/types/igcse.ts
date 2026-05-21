/**
 * IGCSE shelf: EPUB textbooks (distinct from legacy PDF / mixed bookshelf items).
 */
export type IgcsTextbook = {
  id: string;
  title: string;
  subject: string;
  author?: string;
  coverImageUrl?: string;
  description?: string;
  /** Remote HTTPS URL or future signed URL for the EPUB asset */
  epubUrl: string;
  /** 0–100 from API when available */
  progressPercent?: number;
  /** ISO timestamp of last read */
  lastReadAt?: string;
};

export type EpubTocItem = {
  id: string;
  label: string;
  href: string;
  children?: EpubTocItem[];
};

/**
 * Stable annotation anchor for the WebView epub.js bridge and future native readers.
 * Prefer `startCfi` when present; `chapterHref` helps server payloads and human-readable fallbacks.
 */
export type EpubLocationRef = {
  startCfi?: string;
  endCfi?: string;
  chapterHref?: string;
  /** First ~200 chars at location for disambiguation when CFI drifts */
  excerpt?: string;
};

export type EpubBookmark = {
  id: string;
  bookId: string;
  label: string;
  createdAt: string;
  location: EpubLocationRef;
};

export type EpubHighlight = {
  id: string;
  bookId: string;
  color: string;
  createdAt: string;
  location: EpubLocationRef;
  /** When the WebView cannot expose a precise range, we still keep user-visible context */
  fallbackNote?: string;
};

export type EpubNote = {
  id: string;
  bookId: string;
  body: string;
  createdAt: string;
  location: EpubLocationRef;
};

export type EpubReadingProgress = {
  bookId: string;
  /** Normalized 0–1 when known */
  fraction: number;
  /** epub.js start CFI when available */
  startCfi?: string;
  updatedAt: string;
};
