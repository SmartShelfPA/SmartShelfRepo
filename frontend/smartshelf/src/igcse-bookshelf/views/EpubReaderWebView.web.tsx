import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { buildEpubReaderHtml } from './buildEpubReaderHtml';
import type { EpubReaderHandle, EpubReaderOutboundMessage } from './epubReaderTypes';

export type { EpubReaderHandle, EpubReaderOutboundMessage };

type Props = {
  epubUrl: string;
  initialStartCfi?: string | null;
  fetchHeaders?: Record<string, string>;
  onMessage?: (msg: EpubReaderOutboundMessage) => void;
  sessionKey?: number;
};

/**
 * Web/Electron EPUB reader — iframe + postMessage (no react-native-webview).
 */
export const EpubReaderWebView = forwardRef<EpubReaderHandle, Props>(
  function EpubReaderWebViewWeb(
    { epubUrl, initialStartCfi, fetchHeaders, onMessage, sessionKey = 0 },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const sendToWeb = useCallback((payload: Record<string, unknown>) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(
          { source: 'smartshelf-epub-host', action: 'receive', msgJson: JSON.stringify(payload) },
          '*'
        );
        const fn = (win as Window & { smartshelfReceive?: (s: string) => void }).smartshelfReceive;
        if (typeof fn === 'function') {
          fn(JSON.stringify(payload));
        }
      } catch {
        // ignore
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        send: (msg) => sendToWeb(msg),
      }),
      [sendToWeb]
    );

    useEffect(() => {
      const onWinMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if ((data as { source?: string }).source !== 'smartshelf-epub') return;
        const payload = (data as { payload?: string }).payload;
        if (typeof payload !== 'string') return;
        try {
          onMessage?.(JSON.parse(payload) as EpubReaderOutboundMessage);
        } catch {
          // ignore
        }
      };
      window.addEventListener('message', onWinMessage);
      return () => window.removeEventListener('message', onWinMessage);
    }, [onMessage]);

    const html = buildEpubReaderHtml(epubUrl, initialStartCfi, fetchHeaders);

    return (
      <View style={styles.wrap}>
        <iframe
          key={`epub-${sessionKey}-${epubUrl}`}
          ref={iframeRef}
          title="EPUB reader"
          srcDoc={html}
          style={styles.frame as object}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0 },
  frame: { borderWidth: 0, width: '100%', height: '100%', flex: 1 },
});
