import { useEffect, type RefObject } from 'react';

import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
  type NewAnnotation,
} from '@/src/api/annotations';

type ViewerMessage = {
  source?: string;
  type?: string;
  reqId?: number;
  page?: number;
  id?: string;
  text?: string;
  annotation?: NewAnnotation;
};

/**
 * Answers annotation requests from the same-origin PDF.js iframe (public/pdf-viewer.html),
 * so the iframe never needs the auth token.
 */
export function usePdfAnnotationBridge(
  frameRef: RefObject<HTMLIFrameElement | null>,
  assetId: string | undefined,
  onPage?: (page: number) => void
) {
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const msg = (event.data ?? {}) as ViewerMessage;
      if (msg.source !== 'ss-pdf') return;

      if (msg.type === 'page') {
        if (typeof msg.page === 'number') onPage?.(msg.page);
        return;
      }
      if (!assetId || typeof msg.reqId !== 'number') return;

      const reply = (ok: boolean, payload: { data?: unknown; error?: string }) =>
        frame.contentWindow?.postMessage({ source: 'ss-host', reqId: msg.reqId, ok, ...payload }, window.location.origin);

      try {
        let data: unknown;
        if (msg.type === 'list') data = await listAnnotations(assetId, msg.page);
        else if (msg.type === 'create' && msg.annotation) data = await createAnnotation(assetId, msg.annotation);
        else if (msg.type === 'update' && msg.id) data = await updateAnnotation(assetId, msg.id, { text: msg.text ?? '' });
        else if (msg.type === 'delete' && msg.id) data = await deleteAnnotation(assetId, msg.id);
        else throw new Error('Unknown request');
        reply(true, { data });
      } catch (e) {
        reply(false, { error: e instanceof Error ? e.message : 'Failed' });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [frameRef, assetId, onPage]);
}
