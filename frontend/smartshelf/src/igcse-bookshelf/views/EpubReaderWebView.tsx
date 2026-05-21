import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { buildEpubReaderHtml } from './buildEpubReaderHtml';

export type EpubReaderOutboundMessage =
  | { type: 'debug'; message: string }
  | { type: 'ready' }
  | {
      type: 'relocated';
      fraction: number;
      startCfi?: string;
      endCfi?: string;
      /** Spine/content document href when epub.js exposes it (annotation + API sync). */
      chapterHref?: string;
    }
  | { type: 'toc'; toc: unknown }
  | { type: 'error'; message: string };

export type EpubReaderHandle = {
  send: (msg: Record<string, unknown>) => void;
};

type Props = {
  epubUrl: string;
  initialStartCfi?: string | null;
  onMessage?: (msg: EpubReaderOutboundMessage) => void;
  /** Bump to force a fresh WebView document (e.g. retry after failure). */
  sessionKey?: number;
};

export const EpubReaderWebView = forwardRef<EpubReaderHandle, Props>(
  function EpubReaderWebView({ epubUrl, initialStartCfi, onMessage, sessionKey = 0 }, ref) {
    const webRef = useRef<WebView>(null);

    const sendToWeb = useCallback((payload: Record<string, unknown>) => {
      const js = `window.smartshelfReceive(${JSON.stringify(JSON.stringify(payload))}); true;`;
      webRef.current?.injectJavaScript(js);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        send: (msg) => sendToWeb(msg),
      }),
      [sendToWeb]
    );

    const handleMsg = useCallback(
      (e: WebViewMessageEvent) => {
        try {
          const raw = e.nativeEvent.data;
          const parsed = JSON.parse(raw) as EpubReaderOutboundMessage;
          onMessage?.(parsed);
        } catch {
          // ignore
        }
      },
      [onMessage]
    );

    const html = buildEpubReaderHtml(epubUrl, initialStartCfi);

    return (
      <View style={styles.wrap}>
        <WebView
          key={`epub-${sessionKey}-${epubUrl}`}
          ref={webRef}
          style={styles.web}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://cdn.jsdelivr.net' }}
          onMessage={handleMsg}
          onHttpError={(e) => {
            onMessage?.({
              type: 'error',
              message: `WebView HTTP ${e.nativeEvent.statusCode}: ${e.nativeEvent.description || 'request failed'}`,
            });
          }}
          onError={(e) => {
            const desc = e.nativeEvent.description || 'WebView load error';
            onMessage?.({ type: 'error', message: desc });
          }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mixedContentMode="always"
          setSupportMultipleWindows={false}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
});
