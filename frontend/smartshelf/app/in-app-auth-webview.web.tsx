import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, type Router } from 'expo-router';
import { getBackendBaseUrl } from '@/services/api';

const DEFAULT_AUTH_URL = 'https://my-backend.com/auth';
const PDF_JS_VIEWER = 'https://mozilla.github.io/pdf.js/web/viewer.html';

function buildPdfProxyUrl(pdfUrl: string): string {
  const base = getBackendBaseUrl();
  return `${base}/api/pdf-proxy/?url=${encodeURIComponent(pdfUrl)}`;
}

export function openPdfInWebView(router: Router, pdfUrl: string): void {
  const proxyUrl = buildPdfProxyUrl(pdfUrl);
  const viewerUrl = `${PDF_JS_VIEWER}?file=${encodeURIComponent(proxyUrl)}`;
  router.push({ pathname: '/in-app-auth-webview', params: { url: viewerUrl, pdfUrl } });
}

function isPdfUrl(url: string): boolean {
  return url?.toLowerCase().trim().endsWith('.pdf') ?? false;
}

function isPdfJsViewerUrl(url: string): boolean {
  return url?.toLowerCase().includes('mozilla.github.io/pdf.js') ?? false;
}

function buildDisplayUrl(urlParam: string | undefined, pdfUrlParam: string | undefined): string {
  const raw = urlParam?.trim() ?? '';
  if (!raw) return DEFAULT_AUTH_URL;
  if (isPdfUrl(raw)) {
    const proxyUrl = buildPdfProxyUrl(raw);
    return `${PDF_JS_VIEWER}?file=${encodeURIComponent(proxyUrl)}`;
  }
  if (isPdfJsViewerUrl(raw)) return raw;
  if (pdfUrlParam && isPdfUrl(pdfUrlParam)) {
    const proxyUrl = buildPdfProxyUrl(pdfUrlParam);
    return `${PDF_JS_VIEWER}?file=${encodeURIComponent(proxyUrl)}`;
  }
  return raw;
}

/** Web/Electron in-app browser — iframe instead of react-native-webview. */
export default function InAppAuthWebViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; pdfUrl?: string; title?: string }>();
  const src = useMemo(
    () => buildDisplayUrl(params.url, params.pdfUrl),
    [params.url, params.pdfUrl]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {params.title ?? 'Browser'}
        </Text>
        <View style={styles.backBtn} />
      </View>
      <iframe title={params.title ?? 'Browser'} src={src} style={styles.frame as object} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#1a1a1a',
  },
  backBtn: { minWidth: 56 },
  backText: { color: '#00FF41', fontSize: 15, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '600' },
  frame: { borderWidth: 0, width: '100%', height: '100%', flex: 1 },
});
