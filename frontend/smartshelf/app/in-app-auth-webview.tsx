import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams, type Router } from 'expo-router';
import { getBackendBaseUrl } from '@/services/api';
import { speak as speakTts, stop as stopTts } from '@/services/speech-tts';
import {
  addAnnotation,
  getAnnotations,
  type PdfAnnotation,
} from '@/services/pdf-annotations';

const DEFAULT_AUTH_URL = 'https://my-backend.com/auth';

const PDF_JS_VIEWER = 'https://mozilla.github.io/pdf.js/web/viewer.html';
const GOOGLE_DOCS_VIEWER = 'https://docs.google.com/gview?embedded=true';

/** Build proxy URL so PDF.js can load external PDFs (avoids CORS) */
function buildPdfProxyUrl(pdfUrl: string): string {
  const base = getBackendBaseUrl();
  return `${base}/api/pdf-proxy/?url=${encodeURIComponent(pdfUrl)}`;
}

/** Google Docs viewer URL - fallback when proxy unreachable (e.g. physical device + localhost) */
function buildGoogleDocsViewerUrl(pdfUrl: string): string {
  return `${GOOGLE_DOCS_VIEWER}&url=${encodeURIComponent(pdfUrl)}`;
}

/**
 * Opens a PDF in InAppAuthWebView using Mozilla PDF.js viewer.
 * Uses backend proxy to avoid CORS when loading external PDFs.
 * Use from any screen: openPdfInWebView(router, 'https://example.com/file.pdf')
 */
export function openPdfInWebView(router: Router, pdfUrl: string): void {
  const proxyUrl = buildPdfProxyUrl(pdfUrl);
  const viewerUrl = `${PDF_JS_VIEWER}?file=${encodeURIComponent(proxyUrl)}`;
  router.push({ pathname: '/in-app-auth-webview', params: { url: viewerUrl, pdfUrl } });
}

const AUTH_CALLBACK_PREFIX = 'myapp://auth/callback';

const CHROME_120_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PDF_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

function isPdfUrl(url: string): boolean {
  return url?.toLowerCase().trim().endsWith('.pdf') ?? false;
}

function isPdfJsViewerUrl(url: string): boolean {
  return url?.toLowerCase().includes('mozilla.github.io/pdf.js') ?? false;
}

function extractPdfUrlFromViewer(viewerUrl: string): string | null {
  try {
    const match = viewerUrl.match(/[?&]file=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function buildDisplayUrl(
  urlParam: string | undefined,
  pdfUrlParam: string | undefined
): { uri: string; isPdf: boolean; originalPdfUrl: string | null } {
  const raw = urlParam?.trim() ?? '';
  if (raw.length === 0) {
    return { uri: DEFAULT_AUTH_URL, isPdf: false, originalPdfUrl: null };
  }
  if (isPdfUrl(raw)) {
    const proxyUrl = buildPdfProxyUrl(raw);
    const pdfJsUrl = `${PDF_JS_VIEWER}?file=${encodeURIComponent(proxyUrl)}`;
    return { uri: pdfJsUrl, isPdf: true, originalPdfUrl: raw };
  }
  if (isPdfJsViewerUrl(raw)) {
    const extracted = extractPdfUrlFromViewer(raw) ?? pdfUrlParam?.trim();
    return { uri: raw, isPdf: true, originalPdfUrl: extracted || null };
  }
  return { uri: raw, isPdf: false, originalPdfUrl: null };
}

const INJECTED_JS = `
(function() {
  try {
    window.__IN_APP_AUTH_WEBVIEW = true;
    if (typeof navigator !== 'undefined' && navigator.__defineGetter__) {
      var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      navigator.__defineGetter__('userAgent', function() { return ua; });
    }
  } catch (e) {}
})();
true;
`;

/** Injected into PDF.js viewer: read aloud + annotation overlay */
const PDF_READ_ALOUD_JS = `
(function() {
  window.triggerReadAloud = function() {
    try {
      if (typeof PDFViewerApplication === 'undefined') {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'readAloud',error:'Viewer not ready'}));
        return;
      }
      var app = PDFViewerApplication;
      if (!app.pdfDocument) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'readAloud',error:'PDF not loaded'}));
        return;
      }
      var pageNum = app.page || 1;
      app.pdfDocument.getPage(pageNum).then(function(page) {
        return page.getTextContent();
      }).then(function(textContent) {
        var text = (textContent.items || []).map(function(item) { return item.str || ''; }).join(' ');
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'readAloud',text:text,page:pageNum}));
      }).catch(function(e) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'readAloud',error:String(e)}));
      });
    } catch (e) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'readAloud',error:String(e)}));
    }
  };

  window.drawAnnotations = function(annotations) {
    try {
      var container = document.getElementById('viewerContainer') || document.querySelector('.pdfViewer');
      if (!container) return;
      var pages = container.querySelectorAll('.page');
      pages.forEach(function(p) {
        var c = p.querySelector('.__annot_container');
        if (c) c.innerHTML = '';
      });
      if (!annotations || !annotations.length) return;
      annotations.forEach(function(a) {
        var pageEl = pages[a.page - 1];
        if (!pageEl) return;
        var rect = pageEl.getBoundingClientRect();
        var box = document.createElement('div');
        box.style.cssText = 'position:absolute;background:rgba(255,255,0,0.35);border-radius:2px;pointer-events:none;';
        box.style.left = (a.left * rect.width) + 'px';
        box.style.top = (a.top * rect.height) + 'px';
        box.style.width = (a.width * rect.width) + 'px';
        box.style.height = (a.height * rect.height) + 'px';
        pageEl.style.position = 'relative';
        if (!pageEl.querySelector('.__annot_container')) {
          var cont = document.createElement('div');
          cont.className = '__annot_container';
          cont.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:hidden;';
          pageEl.appendChild(cont);
        }
        pageEl.querySelector('.__annot_container').appendChild(box);
      });
    } catch (e) { console.warn('drawAnnotations', e); }
  };

  window.enterHighlightMode = function() {
    var container = document.getElementById('viewerContainer') || document.querySelector('.pdfViewer');
    if (!container) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'annotation',error:'Viewer not ready'})); return; }
    var startX, startY, pageNum, pageEl, pageRect;
    function getPageAt(x, y) {
      var pages = container.querySelectorAll('.page');
      for (var i = 0; i < pages.length; i++) {
        var r = pages[i].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { el: pages[i], i: i + 1, rect: r };
      }
      return null;
    }
    function onDown(e) {
      var x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var y = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
      var p = getPageAt(x, y);
      if (!p) return;
      startX = x; startY = y; pageNum = p.i; pageEl = p.el; pageRect = p.rect;
      e.preventDefault();
    }
    function onUp(e) {
      if (pageNum === undefined) return;
      var x = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : e.clientX;
      var y = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : e.clientY;
      var left = Math.min(startX, x) - pageRect.left;
      var top = Math.min(startY, y) - pageRect.top;
      var width = Math.abs(x - startX);
      var height = Math.abs(y - startY);
      if (width > 5 && height > 5) {
        var rel = { page: pageNum, left: left/pageRect.width, top: top/pageRect.height, width: width/pageRect.width, height: height/pageRect.height };
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'annotation',annotation:rel}));
      }
      document.removeEventListener('mousedown', onDown); document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchstart', onDown, true); document.removeEventListener('touchend', onUp, true);
      pageNum = undefined;
    }
    document.addEventListener('mousedown', onDown); document.addEventListener('mouseup', onUp);
    document.addEventListener('touchstart', onDown, true); document.addEventListener('touchend', onUp, true);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'annotation',status:'ready'}));
  };
})();
true;
`;

type NavState = {
  url: string;
  title?: string;
  loading?: boolean;
};

export default function InAppAuthWebViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; pdfUrl?: string }>();
  const urlParam = typeof params.url === 'string' ? params.url : undefined;
  const pdfUrlParam = typeof params.pdfUrl === 'string' ? params.pdfUrl : undefined;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [useGoogleDocsFallback, setUseGoogleDocsFallback] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const displayResult = buildDisplayUrl(urlParam, pdfUrlParam);
  const { originalPdfUrl } = displayResult;
  const isPdf = displayResult.isPdf;
  const baseUri = useGoogleDocsFallback && originalPdfUrl
    ? buildGoogleDocsViewerUrl(originalPdfUrl)
    : displayResult.uri;
  const source = {
    uri: baseUri,
    headers: [{ name: 'User-Agent', value: isPdf ? PDF_USER_AGENT : 'DesktopChrome' }],
  };

  const handleAuthCallback = useCallback(
    async (url: string): Promise<boolean> => {
      const isCallback = url.startsWith(AUTH_CALLBACK_PREFIX);
      if (!isCallback) {
        return false;
      }
      try {
        const queryStart = url.indexOf('?');
        const query = queryStart >= 0 ? url.slice(queryStart + 1) : '';
        const searchParams = new URLSearchParams(query);
        const token = searchParams.get('token');
        const userId = searchParams.get('userId');

        if (!token) {
          console.warn('[InAppAuthWebView] auth/callback missing token');
          return true;
        }

        await AsyncStorage.setItem('authToken', token);
        if (userId) {
          await AsyncStorage.setItem('authUserId', userId);
        }
        console.log('[InAppAuthWebView] auth callback: token and userId stored');

        setShowSuccess(true);
        setTimeout(() => {
          router.replace('/');
        }, 1500);
        return true;
      } catch (e) {
        console.error('[InAppAuthWebView] auth callback error', e);
        setError('Failed to save auth');
        return true;
      }
    },
    [router]
  );

  const handleNavigationStateChange = useCallback(
    async (navState: NavState) => {
      console.log('[InAppAuthWebView] nav', {
        url: navState.url,
        title: navState.title,
        loading: navState.loading,
      });

      const handled = await handleAuthCallback(navState.url);
      if (handled) {
        return;
      }
    },
    [handleAuthCallback]
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenInBrowser = useCallback(() => {
    if (originalPdfUrl) {
      Linking.openURL(originalPdfUrl);
    }
  }, [originalPdfUrl]);

  const handleTryGoogleDocs = useCallback(() => {
    setUseGoogleDocsFallback(true);
    setError(null);
    setLoading(true);
    setLoadingTimeout(false);
    setTimeout(() => webViewRef.current?.reload(), 100);
  }, []);

  const handleReadAloud = useCallback(() => {
    if (useGoogleDocsFallback) return;
    webViewRef.current?.injectJavaScript('window.triggerReadAloud && window.triggerReadAloud();');
  }, [useGoogleDocsFallback]);

  const handleAddHighlight = useCallback(() => {
    if (useGoogleDocsFallback) return;
    webViewRef.current?.injectJavaScript('window.enterHighlightMode && window.enterHighlightMode();');
  }, [useGoogleDocsFallback]);

  const handleStopSpeaking = useCallback(() => {
    stopTts();
    setIsSpeaking(false);
  }, []);

  const handleWebViewMessage = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === 'readAloud') {
          if (data.error) {
            console.warn('[ReadAloud]', data.error);
            return;
          }
          if (data.text && data.text.trim()) {
            setIsSpeaking(true);
            speakTts(data.text.trim(), {
              onDone: () => setIsSpeaking(false),
              onStopped: () => setIsSpeaking(false),
              onError: () => setIsSpeaking(false),
            });
          }
        }
        if (data?.type === 'annotation' && originalPdfUrl) {
          if (data.error) {
            console.warn('[Annotation]', data.error);
            return;
          }
          if (data.annotation) {
            const ann = await addAnnotation(originalPdfUrl, {
              page: data.annotation.page,
              type: 'highlight',
              left: data.annotation.left,
              top: data.annotation.top,
              width: data.annotation.width,
              height: data.annotation.height,
            } as Omit<import('@/services/pdf-annotations').PdfAnnotation, 'id'>);
            const all = await getAnnotations(originalPdfUrl);
            webViewRef.current?.injectJavaScript(
              `window.drawAnnotations && window.drawAnnotations(${JSON.stringify(all)});`
            );
          }
        }
      } catch (_) {}
    },
    [originalPdfUrl]
  );

  // If PDF keeps loading for 12s, show "Open in Browser" option
  useEffect(() => {
    if (!isPdf || !loading || !originalPdfUrl) return;
    const timer = setTimeout(() => setLoadingTimeout(true), 12000);
    return () => clearTimeout(timer);
  }, [isPdf, loading, originalPdfUrl]);

  useEffect(() => {
    if (!loading) setLoadingTimeout(false);
  }, [loading]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={source}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled={true}
        incognito={false}
        userAgent={isPdf ? PDF_USER_AGENT : CHROME_120_UA}
        startInLoadingState={true}
        pullToRefreshEnabled={true}
        injectedJavaScript={isPdf ? (useGoogleDocsFallback ? undefined : PDF_READ_ALOUD_JS) : INJECTED_JS}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        scalesPageToFit={isPdf ? true : undefined}
        setBuiltInZoomControls={isPdf}
        setDisplayZoomControls={isPdf}
        renderLoading={() => (
          <View style={styles.renderLoadingContainer}>
            <ActivityIndicator size="large" color="#00FF41" />
            <Text style={styles.renderLoadingText}>Loading...</Text>
          </View>
        )}
        onLoadStart={() => {
          setLoading(true);
          setError(null);
          console.log('[InAppAuthWebView] onLoadStart');
        }}
        onLoadEnd={async () => {
          setLoading(false);
          console.log('[InAppAuthWebView] onLoadEnd');
          if (originalPdfUrl && !useGoogleDocsFallback) {
            try {
              const annotations = await getAnnotations(originalPdfUrl);
              if (annotations.length > 0) {
                const delay = () =>
                  webViewRef.current?.injectJavaScript(
                    `window.drawAnnotations && window.drawAnnotations(${JSON.stringify(annotations)});`
                  );
                setTimeout(delay, 1500);
              }
            } catch (_) {}
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.log('WebView error: ', nativeEvent);
          const msg = `WebView error: code=${nativeEvent?.code ?? '?'} desc=${nativeEvent?.description ?? 'unknown'}`;
          setError(msg);
          setLoading(false);
        }}
        onHttpError={(e) => {
          const { nativeEvent } = e;
          const msg = `HTTP error: status=${nativeEvent?.statusCode ?? '?'} url=${nativeEvent?.url ?? '?'}`;
          console.error('[InAppAuthWebView] onHttpError', msg, nativeEvent);
          setError(msg);
          setLoading(false);
        }}
        renderError={(errorName) => (
          <View style={styles.renderErrorContainer}>
            <Text style={styles.renderErrorText}>Failed to load. Retrying...</Text>
            <TouchableOpacity style={styles.renderErrorButton} onPress={handleRetry} activeOpacity={0.8}>
              <Text style={styles.renderErrorButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={handleNavigationStateChange}
      />
      {isPdf && (
        <>
          <View style={[styles.pdfTitleBar, { top: Math.max(insets.top, 16) + 8 }]}>
            <Text style={styles.pdfTitleText}>PDF Viewer</Text>
          </View>
          {originalPdfUrl && (
            <View style={styles.pdfActions}>
              {!useGoogleDocsFallback && (
                <>
                  <TouchableOpacity
                    style={[styles.openInBrowserButton, isSpeaking && styles.speakingButton]}
                    onPress={isSpeaking ? handleStopSpeaking : handleReadAloud}
                    activeOpacity={0.8}>
                    <Text style={styles.openInBrowserText}>
                      {isSpeaking ? 'Stop' : 'Read Aloud'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.openInBrowserButton}
                    onPress={handleAddHighlight}
                    activeOpacity={0.8}>
                    <Text style={styles.openInBrowserText}>Add Highlight</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.openInBrowserButton}
                    onPress={handleTryGoogleDocs}
                    activeOpacity={0.8}>
                    <Text style={styles.openInBrowserText}>Try Google Docs</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={styles.openInBrowserButton}
                onPress={handleOpenInBrowser}
                activeOpacity={0.8}>
                <Text style={styles.openInBrowserText}>Open in Browser</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
      <TouchableOpacity
        style={[styles.closeButton, { top: Math.max(insets.top, 16) + 8 }]}
        onPress={handleClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Close"
        accessibilityRole="button">
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
      {showSuccess && (
        <View style={styles.successOverlay}>
          <Text style={styles.successText}>Logged in!</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            {originalPdfUrl && !useGoogleDocsFallback && (
              <TouchableOpacity
                style={styles.openInBrowserButton}
                onPress={handleTryGoogleDocs}
                activeOpacity={0.8}>
                <Text style={styles.openInBrowserText}>Try Google Docs</Text>
              </TouchableOpacity>
            )}
            {originalPdfUrl && (
              <TouchableOpacity
                style={styles.openInBrowserButton}
                onPress={handleOpenInBrowser}
                activeOpacity={0.8}>
                <Text style={styles.openInBrowserText}>Open in Browser</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00FF41" />
          {loadingTimeout && originalPdfUrl && (
            <View style={styles.loadingTimeoutHint}>
              <Text style={styles.loadingTimeoutText}>
                Taking too long? Try another viewer.
              </Text>
              <View style={styles.loadingTimeoutButtons}>
                {!useGoogleDocsFallback && (
                  <TouchableOpacity
                    style={styles.loadingTimeoutButton}
                    onPress={handleTryGoogleDocs}
                    activeOpacity={0.8}>
                    <Text style={styles.openInBrowserText}>Try Google Docs</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.loadingTimeoutButton}
                  onPress={handleOpenInBrowser}
                  activeOpacity={0.8}>
                  <Text style={styles.openInBrowserText}>Open in Browser</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pdfTitleBar: {
    position: 'absolute',
    left: 16,
    right: 56,
    zIndex: 10,
    justifyContent: 'center',
  },
  pdfTitleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  webview: {
    flex: 1,
  },
  renderLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  renderLoadingText: {
    fontSize: 14,
    color: '#333',
  },
  renderErrorContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  renderErrorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  renderErrorButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#00FF41',
    borderRadius: 8,
  },
  renderErrorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingTimeoutHint: {
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  loadingTimeoutButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  loadingTimeoutText: {
    fontSize: 14,
    color: '#333',
  },
  loadingTimeoutButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#00FF41',
    borderRadius: 8,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 255, 65, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00FF41',
  },
  pdfActions: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 10,
  },
  openInBrowserButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#00FF41',
    borderRadius: 8,
  },
  speakingButton: {
    backgroundColor: '#FF6B6B',
  },
  openInBrowserText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(200, 0, 0, 0.9)',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
  },
  errorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
