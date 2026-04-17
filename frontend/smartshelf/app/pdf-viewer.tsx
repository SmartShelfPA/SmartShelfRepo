import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getBackendBaseUrl } from '@/services/api';
import {
  getAnnotations,
  addAnnotation,
  type PdfAnnotation,
} from '@/services/pdf-annotations';

const PDF_JS_VIEWER = 'https://mozilla.github.io/pdf.js/web/viewer.html';
const GOOGLE_DOCS_VIEWER = 'https://docs.google.com/gview?embedded=true';

function buildPdfProxyUrl(pdfUrl: string): string {
  const base = getBackendBaseUrl();
  return `${base}/api/pdf-proxy/?url=${encodeURIComponent(pdfUrl)}`;
}

function buildGoogleDocsUrl(pdfUrl: string): string {
  return `${GOOGLE_DOCS_VIEWER}&url=${encodeURIComponent(pdfUrl)}`;
}

const ANNOTATION_SCRIPT = `
(function() {
  var mode = null;
  var drawPath = [];

  function getContainer() {
    return document.getElementById('viewerContainer') || document.querySelector('.pdfViewer');
  }

  function getPageAt(x, y) {
    var container = getContainer();
    if (!container) return null;
    var pages = container.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      var r = pages[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return { el: pages[i], i: i + 1, rect: r };
      }
    }
    return null;
  }

  function toRelative(p, rect) {
    return { x: (p.x - rect.left) / rect.width, y: (p.y - rect.top) / rect.height };
  }

  window.setAnnotationMode = function(m) { mode = m; };

  window.drawAllAnnotations = function(annotations) {
    var container = getContainer();
    if (!container) return;
    var pages = container.querySelectorAll('.page');
    pages.forEach(function(p) {
      var c = p.querySelector('.__annot_layer');
      if (c) c.innerHTML = '';
    });
    if (!annotations || !annotations.length) return;
    annotations.forEach(function(a) {
      var pageEl = pages[a.page - 1];
      if (!pageEl) return;
      ensureLayer(pageEl);
      var layer = pageEl.querySelector('.__annot_layer');
      var rect = pageEl.getBoundingClientRect();
      if (a.type === 'highlight') {
        var box = document.createElement('div');
        box.style.cssText = 'position:absolute;background:rgba(255,255,0,0.4);border-radius:2px;pointer-events:none;';
        box.style.left = (a.left * rect.width) + 'px';
        box.style.top = (a.top * rect.height) + 'px';
        box.style.width = (a.width * rect.width) + 'px';
        box.style.height = (a.height * rect.height) + 'px';
        layer.appendChild(box);
      } else if (a.type === 'sticky') {
        var sticky = document.createElement('div');
        sticky.style.cssText = 'position:absolute;background:#ffeb3b;border:1px solid #f9a825;border-radius:4px;padding:6px;min-width:80px;min-height:40px;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.2);pointer-events:none;';
        sticky.style.left = (a.left * rect.width) + 'px';
        sticky.style.top = (a.top * rect.height) + 'px';
        sticky.style.width = Math.max(80, (a.width || 0.15) * rect.width) + 'px';
        sticky.innerHTML = (a.text || 'Note').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        layer.appendChild(sticky);
      } else if (a.type === 'draw' && a.path && a.path.length > 1) {
        var canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
        var ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = a.color || '#e53935';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(a.path[0].x * rect.width, a.path[0].y * rect.height);
          for (var j = 1; j < a.path.length; j++) {
            ctx.lineTo(a.path[j].x * rect.width, a.path[j].y * rect.height);
          }
          ctx.stroke();
        }
        layer.appendChild(canvas);
      }
    });
  };

  function ensureLayer(pageEl) {
    if (!pageEl.querySelector('.__annot_layer')) {
      var layer = document.createElement('div');
      layer.className = '__annot_layer';
      layer.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:hidden;';
      pageEl.style.position = 'relative';
      pageEl.appendChild(layer);
    }
  }

  function setupListeners() {
    var container = getContainer();
    if (!container) return setTimeout(setupListeners, 500);
    var startX, startY, pageNum, pageRect, pageEl;

    function onDown(e) {
      var x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var y = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
      var p = getPageAt(x, y);
      if (!p) return;
      if (mode === 'highlight' || mode === 'draw') e.preventDefault();
      startX = x; startY = y; pageNum = p.i; pageRect = p.rect; pageEl = p.el;
      if (mode === 'draw') drawPath = [toRelative({x:x,y:y}, pageRect)];
    }

    function onMove(e) {
      if (mode !== 'draw' || pageNum === undefined) return;
      var x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var y = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
      drawPath.push(toRelative({x:x,y:y}, pageRect));
    }

    function onUp(e) {
      if (pageNum === undefined) return;
      var x = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : e.clientX;
      var y = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : e.clientY;
      if (mode === 'highlight') {
        var left = Math.min(startX, x) - pageRect.left;
        var top = Math.min(startY, y) - pageRect.top;
        var w = Math.abs(x - startX);
        var h = Math.abs(y - startY);
        if (w > 8 && h > 8) {
          post({ type: 'annotation', annotation: { type: 'highlight', page: pageNum, left: left/pageRect.width, top: top/pageRect.height, width: w/pageRect.width, height: h/pageRect.height } });
        }
      } else if (mode === 'sticky') {
        var l = (Math.min(startX, x) - pageRect.left) / pageRect.width;
        var t = (Math.min(startY, y) - pageRect.top) / pageRect.height;
        post({ type: 'stickyPlace', page: pageNum, left: l, top: t, width: 0.15, height: 0.08 });
      } else if (mode === 'draw' && drawPath.length > 2) {
        post({ type: 'annotation', annotation: { type: 'draw', page: pageNum, path: drawPath } });
      }
      pageNum = undefined;
      drawPath = [];
    }

    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('touchend', onUp, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
  }

  function post(obj) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }

  setTimeout(setupListeners, 2000);
})();
true;
`;

export default function PdfViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor({}, 'text');
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<'none' | 'highlight' | 'sticky' | 'draw'>('none');
  const [stickyModal, setStickyModal] = useState<{
    page: number;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [stickyText, setStickyText] = useState('');
  const [useGoogleDocsFallback, setUseGoogleDocsFallback] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const pdfUri = typeof uri === 'string' ? uri : '';
  const proxyUrl = pdfUri ? buildPdfProxyUrl(pdfUri) : '';
  const viewerUrl = useGoogleDocsFallback && pdfUri
    ? buildGoogleDocsUrl(pdfUri)
    : proxyUrl
      ? `${PDF_JS_VIEWER}?file=${encodeURIComponent(proxyUrl)}`
      : '';

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const injectTool = useCallback(
    (t: 'none' | 'highlight' | 'sticky' | 'draw') => {
      setTool(t);
      webViewRef.current?.injectJavaScript(
        `window.setAnnotationMode && window.setAnnotationMode(${t === 'none' ? 'null' : `'${t}'`});`
      );
    },
    []
  );

  const handleMessage = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === 'annotation' && data.annotation && pdfUri) {
          const ann = await addAnnotation(pdfUri, data.annotation);
          const all = await getAnnotations(pdfUri);
          webViewRef.current?.injectJavaScript(
            `window.drawAllAnnotations && window.drawAllAnnotations(${JSON.stringify(all)});`
          );
        }
        if (data?.type === 'stickyPlace') {
          setStickyModal({
            page: data.page,
            left: data.left,
            top: data.top,
            width: data.width || 0.15,
            height: data.height || 0.08,
          });
        }
      } catch (_) {}
    },
    [pdfUri]
  );

  const handleStickySubmit = useCallback(
    async (text: string) => {
      if (!stickyModal || !pdfUri) return;
      await addAnnotation(pdfUri, {
        type: 'sticky',
        page: stickyModal.page,
        left: stickyModal.left,
        top: stickyModal.top,
        width: stickyModal.width,
        height: stickyModal.height,
        text: text.trim() || 'Note',
      });
      setStickyModal(null);
      setStickyText('');
      injectTool('none');
      const all = await getAnnotations(pdfUri);
      webViewRef.current?.injectJavaScript(
        `window.drawAllAnnotations && window.drawAllAnnotations(${JSON.stringify(all)});`
      );
    },
    [stickyModal, pdfUri, injectTool]
  );

  useEffect(() => {
    if (tool !== 'none') {
      webViewRef.current?.injectJavaScript(
        `window.setAnnotationMode && window.setAnnotationMode('${tool}');`
      );
    }
  }, [tool]);

  useEffect(() => {
    if (!pdfUri || !viewerUrl || useGoogleDocsFallback) return;
    let mounted = true;
    const loadAnnotations = async () => {
      try {
        const annotations = await getAnnotations(pdfUri);
        if (mounted && annotations.length > 0) {
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(
              `window.drawAllAnnotations && window.drawAllAnnotations(${JSON.stringify(annotations)});`
            );
          }, 2500);
        }
      } catch (_) {}
    };
    loadAnnotations();
    return () => {
      mounted = false;
    };
  }, [pdfUri, viewerUrl, useGoogleDocsFallback]);

  if (!pdfUri) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={handleBack}
          activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <Text style={[styles.errorText, { color: iconColor }]}>No PDF URL provided</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={handleBack}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Go back"
        accessibilityRole="button">
        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
      </TouchableOpacity>

      <WebView
        key={viewerUrl}
        ref={webViewRef}
        source={{ uri: viewerUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onLoadEnd={() => {
          setLoading(false);
          setLoadError(false);
        }}
        onError={() => {
          setLoading(false);
          setLoadError(true);
        }}
        onHttpError={() => setLoadError(true)}
        onMessage={handleMessage}
        injectedJavaScript={useGoogleDocsFallback ? undefined : ANNOTATION_SCRIPT}
      />

      {loadError && pdfUri && (
        <View style={styles.fallbackBar}>
          <Text style={styles.fallbackText}>PDF failed to load</Text>
          <TouchableOpacity
            style={styles.fallbackBtn}
            onPress={() => {
              setUseGoogleDocsFallback(!useGoogleDocsFallback);
              setLoading(true);
              setLoadError(false);
            }}>
            <Text style={styles.fallbackBtnText}>
              {useGoogleDocsFallback ? 'Try PDF.js' : 'Try Google Docs'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {useGoogleDocsFallback && pdfUri && (
        <View style={[styles.annotationsPrompt, { bottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.annotationsPromptBtn}
            onPress={() => {
              setUseGoogleDocsFallback(false);
              setLoading(true);
            }}>
            <MaterialIcons name="edit" size={20} color="#000" />
            <Text style={styles.annotationsPromptText}>Try with annotations</Text>
          </TouchableOpacity>
        </View>
      )}

      {!useGoogleDocsFallback && (
      <View style={[styles.toolbar, { bottom: insets.bottom + 16 }]}>
          <>
            <TouchableOpacity
              style={[styles.toolBtn, tool === 'highlight' && styles.toolBtnActive]}
              onPress={() => injectTool(tool === 'highlight' ? 'none' : 'highlight')}>
              <MaterialIcons
                name="highlight"
                size={24}
                color={tool === 'highlight' ? '#00FF41' : iconColor}
              />
              <Text style={[styles.toolLabel, { color: tool === 'highlight' ? '#00FF41' : iconColor }]}>
                Highlight
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolBtn, tool === 'sticky' && styles.toolBtnActive]}
              onPress={() => injectTool(tool === 'sticky' ? 'none' : 'sticky')}>
              <MaterialIcons
                name="note-add"
                size={24}
                color={tool === 'sticky' ? '#00FF41' : iconColor}
              />
              <Text style={[styles.toolLabel, { color: tool === 'sticky' ? '#00FF41' : iconColor }]}>
                Note
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolBtn, tool === 'draw' && styles.toolBtnActive]}
              onPress={() => injectTool(tool === 'draw' ? 'none' : 'draw')}>
              <MaterialIcons
                name="draw"
                size={24}
                color={tool === 'draw' ? '#00FF41' : iconColor}
              />
              <Text style={[styles.toolLabel, { color: tool === 'draw' ? '#00FF41' : iconColor }]}>
                Draw
              </Text>
            </TouchableOpacity>
          </>
      </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00FF41" />
        </View>
      )}

      <Modal
        visible={!!stickyModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setStickyModal(null);
          setStickyText('');
        }}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setStickyModal(null);
            setStickyText('');
          }}>
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={() => {}}
            onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Sticky Note</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter your note..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={stickyText}
              onChangeText={setStickyText}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setStickyModal(null);
                  setStickyText('');
                }}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnSave}
                onPress={() => handleStickySubmit(stickyText)}>
                <Text style={[styles.modalBtnText, { color: '#000' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  toolbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    zIndex: 10,
  },
  toolBtn: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(0,255,65,0.2)',
  },
  toolLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  modalBtnSave: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#00FF41',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  errorText: {
    flex: 1,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  fallbackBar: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(200,0,0,0.9)',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    gap: 12,
    zIndex: 15,
  },
  fallbackText: {
    color: '#fff',
    fontSize: 14,
  },
  fallbackBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#00FF41',
    borderRadius: 8,
  },
  fallbackBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  annotationsPrompt: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  annotationsPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,255,65,0.9)',
    borderRadius: 8,
  },
  annotationsPromptText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
});
