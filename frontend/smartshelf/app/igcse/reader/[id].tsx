import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIgcsReaderSession } from '@/src/hooks/useIgcsReaderSession';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { EpubReaderHandle, EpubReaderOutboundMessage } from '@/src/igcse-bookshelf/views/EpubReaderWebView';
import { EpubReaderWebView } from '@/src/igcse-bookshelf/views/EpubReaderWebView';
import { flattenEpubToc, type FlatTocEntry } from '@/src/igcse-bookshelf/views/flattenToc';
import { probeEpubUrl } from '@/src/lib/probeEpubUrl';
import {
  deleteBookmarkRemote,
  deleteHighlightRemote,
  deleteNoteRemote,
  fetchIgcsReaderAnnotationsBundle,
  getIGCSEBookDetail,
  isBackendIgcsBookId,
  isBackendIgcsEntityId,
  saveBookmarkRemote,
  saveHighlightRemote,
  saveNoteRemote,
} from '@/src/services/igcseEpubService';
import type { EpubLocationRef, IgcsTextbook } from '@/src/types/igcse';
import { useIgcsReaderStore } from '@/src/store/igcseReaderStore';

function chapterBasename(href?: string) {
  if (!href) return '';
  const clean = href.split('#')[0] ?? href;
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? clean;
}

export default function IgcsReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const bookId = Array.isArray(id) ? id[0] : id;

  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const webRef = useRef<EpubReaderHandle>(null);
  const lastAnchorRef = useRef<EpubLocationRef>({});
  const lastFractionRef = useRef(0);
  const [livePct, setLivePct] = useState<number | null>(null);

  const [book, setBook] = useState<IgcsTextbook | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookError, setBookError] = useState<string | null>(null);
  const [toc, setToc] = useState<FlatTocEntry[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [showShelf, setShowShelf] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [annotationTab, setAnnotationTab] = useState<'bookmarks' | 'highlights' | 'notes'>(
    'bookmarks'
  );
  const [readerError, setReaderError] = useState<string | null>(null);
  const [epubReady, setEpubReady] = useState(false);
  /** Probe + WebView lifecycle: never leave the user on an infinite overlay. */
  const [epubGate, setEpubGate] = useState<'checking' | 'rendering' | 'blocked'>('checking');
  const [epubGateDetail, setEpubGateDetail] = useState<string | null>(null);
  const [epubSessionKey, setEpubSessionKey] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [chapterHint, setChapterHint] = useState('');

  const reader = useIgcsReaderSession(bookId);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    setBookLoading(true);
    setBookError(null);
    setBook(null);
    setEpubReady(false);
    setEpubGate('checking');
    setEpubGateDetail(null);
    void getIGCSEBookDetail(bookId).then((b) => {
      if (cancelled) return;
      if (!b) {
        setBook(null);
        setBookError('This book could not be loaded. Check your connection or try again.');
        setBookLoading(false);
        return;
      }
      if (!b.epubUrl?.trim()) {
        setBook(null);
        setBookError('No EPUB file is linked for this title yet.');
        setBookLoading(false);
        return;
      }
      setBook(b);
      setBookLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!bookId || !book) return;
    if (!isBackendIgcsBookId(bookId)) return;
    let cancelled = false;
    const store = useIgcsReaderStore.getState();
    store.hydrateProgressFromCatalogIfEmpty(bookId, {
      progressPercent: book.progressPercent,
      lastReadAt: book.lastReadAt,
    });
    void fetchIgcsReaderAnnotationsBundle(bookId).then((bundle) => {
      if (cancelled || !bundle) return;
      useIgcsReaderStore.getState().mergeAnnotationsFromServer(bookId, bundle);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, book]);

  useEffect(() => {
    if (!book?.epubUrl?.trim()) return;
    const url = book.epubUrl.trim();
    let cancelled = false;
    setEpubGate('checking');
    setEpubGateDetail(null);
    setEpubReady(false);
    console.log('[SmartShelf][EPUB] load', { bookId, url });

    void (async () => {
      try {
        await probeEpubUrl(url);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'EPUB URL check failed';
        setEpubGateDetail(msg);
        setEpubGate('blocked');
        setEpubReady(true);
        return;
      }
      if (cancelled) return;
      setEpubGate('rendering');
    })();

    return () => {
      cancelled = true;
    };
  }, [book?.epubUrl, bookId, epubSessionKey]);

  useEffect(() => {
    if (epubGate !== 'rendering') return;
    if (epubReady) return;
    const t = setTimeout(() => {
      setEpubGateDetail(
        'EPUB opening timed out (45s). The WebView parser may be stuck, or the file is too large for this device.'
      );
      setEpubGate('blocked');
      setEpubReady(true);
    }, 45000);
    return () => clearTimeout(t);
  }, [epubGate, epubReady, epubSessionKey]);

  useEffect(() => {
    setChapterHint('');
  }, [bookId]);

  useEffect(() => {
    const fr = reader.progress?.fraction;
    if (fr == null) return;
    setLivePct(Math.round(fr * 100));
  }, [bookId, reader.progress?.fraction]);

  const initialCfi = reader.progress?.startCfi;

  const sendToWeb = useCallback((msg: Record<string, unknown>) => {
    webRef.current?.send(msg);
  }, []);

  useEffect(() => {
    if (!bookId) return;
    sendToWeb({ action: 'font', scale: reader.settings.fontScale });
    sendToWeb({ action: 'theme', mode: reader.settings.readerTheme });
  }, [bookId, sendToWeb, reader.settings.fontScale, reader.settings.readerTheme]);

  const onWebMessage = useCallback(
    (msg: EpubReaderOutboundMessage) => {
      if (msg.type === 'debug') {
        console.log('[SmartShelf][EPUB/WebView]', msg.message);
        return;
      }
      if (msg.type === 'toc') {
        setToc(flattenEpubToc(msg.toc));
      }
      if (msg.type === 'ready') {
        setEpubReady(true);
        setReaderError(null);
      }
      if (msg.type === 'relocated') {
        setEpubReady(true);
        lastAnchorRef.current = {
          startCfi: msg.startCfi,
          endCfi: msg.endCfi,
          chapterHref: msg.chapterHref,
        };
        lastFractionRef.current = typeof msg.fraction === 'number' ? msg.fraction : 0;
        setLivePct(Math.round(lastFractionRef.current * 100));
        setChapterHint(chapterBasename(msg.chapterHref));
        if (bookId) {
          reader.setProgress({
            bookId,
            fraction: lastFractionRef.current,
            startCfi: msg.startCfi,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      if (msg.type === 'error') {
        setReaderError(null);
        setEpubGateDetail(msg.message);
        setEpubGate('blocked');
        setEpubReady(true);
      }
    },
    [bookId, reader.setProgress]
  );

  const pctLabel = useMemo(() => {
    const fromSlice =
      reader.progress?.fraction != null ? Math.round(reader.progress.fraction * 100) : null;
    const p =
      livePct ??
      fromSlice ??
      Math.round(lastFractionRef.current * 100);
    return `${Math.min(100, Math.max(0, p))}%`;
  }, [livePct, reader.progress?.fraction]);

  const { bookmarks, highlights, notes } = reader;

  const commitBookmarkAtLocation = useCallback(
    async (showSuccessAlert: boolean) => {
      const cfi = lastAnchorRef.current.startCfi;
      if (!bookId || !cfi) {
        Alert.alert('Bookmark', 'Wait for the page to finish loading.');
        return;
      }
      const location: EpubLocationRef = { ...lastAnchorRef.current, startCfi: cfi };
      const label = `Bookmark · ${new Date().toLocaleTimeString()}`;
      const st = useIgcsReaderStore.getState();
      const tempId = st.addBookmark(bookId, { bookId, label, location });
      if (!isBackendIgcsBookId(bookId)) {
        if (showSuccessAlert) Alert.alert('Saved', 'Bookmark added for this location.');
        return;
      }
      const remote = await saveBookmarkRemote({ bookId, label, location });
      if (remote && tempId !== remote.id) {
        st.replaceBookmark(bookId, tempId, remote);
      }
      if (!remote) {
        Alert.alert(
          'Bookmark',
          'Saved on this device; could not sync to your account (offline or server error).'
        );
      } else if (showSuccessAlert) {
        Alert.alert('Saved', 'Bookmark added for this location.');
      }
    },
    [bookId]
  );

  const commitHighlightAtLocation = useCallback(async () => {
    const cfi = lastAnchorRef.current.startCfi;
    if (!bookId || !cfi) {
      Alert.alert('Highlight', 'Wait for the page to finish loading.');
      return;
    }
    const location: EpubLocationRef = { ...lastAnchorRef.current, startCfi: cfi };
    const fallbackNote =
      'CFI-scoped highlight (epub.js selection UI can refine range later).';
    const st = useIgcsReaderStore.getState();
    const tempId = st.addHighlight(bookId, {
      bookId,
      color: '#FFD54F',
      location,
      fallbackNote,
    });
    if (!isBackendIgcsBookId(bookId)) return;
    const remote = await saveHighlightRemote({
      bookId,
      color: '#FFD54F',
      location,
      fallbackNote,
    });
    if (remote && tempId !== remote.id) {
      st.replaceHighlight(bookId, tempId, remote);
    }
    if (!remote) {
      Alert.alert(
        'Highlight',
        'Saved on this device; could not sync to your account (offline or server error).'
      );
    }
  }, [bookId]);

  const removeBookmarkPressed = useCallback(
    async (annotationId: string) => {
      if (!bookId) return;
      if (isBackendIgcsBookId(bookId) && isBackendIgcsEntityId(annotationId)) {
        const ok = await deleteBookmarkRemote(bookId, annotationId);
        if (ok) useIgcsReaderStore.getState().removeBookmark(bookId, annotationId);
        else Alert.alert('Delete bookmark', 'Could not remove on the server.');
      } else {
        useIgcsReaderStore.getState().removeBookmark(bookId, annotationId);
      }
    },
    [bookId]
  );

  const removeHighlightPressed = useCallback(
    async (annotationId: string) => {
      if (!bookId) return;
      if (isBackendIgcsBookId(bookId) && isBackendIgcsEntityId(annotationId)) {
        const ok = await deleteHighlightRemote(bookId, annotationId);
        if (ok) useIgcsReaderStore.getState().removeHighlight(bookId, annotationId);
        else Alert.alert('Delete highlight', 'Could not remove on the server.');
      } else {
        useIgcsReaderStore.getState().removeHighlight(bookId, annotationId);
      }
    },
    [bookId]
  );

  const removeNotePressed = useCallback(
    async (annotationId: string) => {
      if (!bookId) return;
      if (isBackendIgcsBookId(bookId) && isBackendIgcsEntityId(annotationId)) {
        const ok = await deleteNoteRemote(bookId, annotationId);
        if (ok) useIgcsReaderStore.getState().removeNote(bookId, annotationId);
        else Alert.alert('Delete note', 'Could not remove on the server.');
      } else {
        useIgcsReaderStore.getState().removeNote(bookId, annotationId);
      }
    },
    [bookId]
  );

  const retryLoadBook = useCallback(() => {
    if (!bookId) return;
    setBookLoading(true);
    setBookError(null);
    void getIGCSEBookDetail(bookId).then((b) => {
      if (!b) {
        setBook(null);
        setBookError('This book could not be loaded.');
        setBookLoading(false);
        return;
      }
      if (!b.epubUrl?.trim()) {
        setBook(null);
        setBookError('No EPUB file is linked for this title yet.');
        setBookLoading(false);
        return;
      }
      setBook(b);
      setBookLoading(false);
      setEpubReady(false);
      setEpubGate('checking');
      setEpubGateDetail(null);
      setEpubSessionKey((k) => k + 1);
    });
  }, [bookId]);

  if (!bookId) {
    return (
      <ThemedView style={[styles.wrap, { backgroundColor }]}>
        <ThemedText>Missing book id</ThemedText>
      </ThemedView>
    );
  }

  if (bookLoading) {
    return (
      <ThemedView style={[styles.wrap, { backgroundColor, paddingTop: insets.top }]}>
        <View style={styles.centerBlock}>
          <ActivityIndicator color={tintColor} />
          <ThemedText style={{ color: mutedTextColor }}>Opening textbook…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (bookError || !book) {
    return (
      <ThemedView style={[styles.wrap, { backgroundColor, paddingTop: insets.top }]}>
        <View style={[styles.headerRow, { paddingHorizontal: 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
            <MaterialIcons name="arrow-back" size={22} color={tintColor} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerBlock}>
          <MaterialIcons name="error-outline" size={48} color={mutedTextColor} />
          <ThemedText style={{ color: mutedTextColor, textAlign: 'center' }}>
            {bookError ?? 'Book not found'}
          </ThemedText>
          <TouchableOpacity onPress={retryLoadBook} activeOpacity={0.85}>
            <ThemedText style={{ color: tintColor, fontWeight: '700' }}>Try again</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const bumpFont = (delta: number) => {
    if (!bookId) return;
    const next = Math.min(1.6, Math.max(0.85, reader.settings.fontScale + delta));
    reader.setFontScale(next);
    sendToWeb({ action: 'font', scale: next });
  };

  const toggleTheme = () => {
    if (!bookId) return;
    const next = reader.settings.readerTheme === 'dark' ? 'light' : 'dark';
    reader.setReaderTheme(next);
    sendToWeb({ action: 'theme', mode: next });
  };

  const chromeTop = (
    <View
      style={[
        styles.toolbar,
        { paddingTop: Math.max(insets.top, 10), borderBottomColor: borderColor },
      ]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
        <MaterialIcons name="arrow-back" size={22} color={tintColor} />
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText style={[styles.toolbarTitle, { color: textColor }]} numberOfLines={1}>
          {book.title}
        </ThemedText>
        {chapterHint ? (
          <ThemedText style={{ color: mutedTextColor, fontSize: 12 }} numberOfLines={1}>
            {chapterHint}
          </ThemedText>
        ) : null}
      </View>
      <TouchableOpacity onPress={() => setShowToc(true)} style={styles.iconBtn} activeOpacity={0.85}>
        <MaterialIcons name="toc" size={22} color={tintColor} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setShowShelf(true)}
        style={styles.iconBtn}
        activeOpacity={0.85}>
        <MaterialIcons name="bookmark-add" size={22} color={tintColor} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setFocusMode((v) => !v)}
        style={styles.iconBtn}
        activeOpacity={0.85}
        accessibilityLabel={focusMode ? 'Show reader controls' : 'Focus reading'}>
        <MaterialIcons name={focusMode ? 'unfold-more' : 'unfold-less'} size={22} color={tintColor} />
      </TouchableOpacity>
    </View>
  );

  const controlsRow = (
    <View style={styles.controlsRow}>
      <TouchableOpacity
        style={[styles.smallBtn, { borderColor }]}
        onPress={() => bumpFont(-0.1)}
        activeOpacity={0.85}>
        <MaterialIcons name="remove" size={20} color={textColor} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.smallBtn, { borderColor }]}
        onPress={() => bumpFont(0.1)}
        activeOpacity={0.85}>
        <MaterialIcons name="add" size={20} color={textColor} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.smallBtn, { borderColor }]}
        onPress={toggleTheme}
        activeOpacity={0.85}>
        <MaterialIcons
          name={reader.settings.readerTheme === 'dark' ? 'light-mode' : 'dark-mode'}
          size={20}
          color={textColor}
        />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <ThemedText style={{ color: mutedTextColor, fontWeight: '700' }}>{pctLabel}</ThemedText>
    </View>
  );

  const footer = (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: borderColor }]}>
      <TouchableOpacity
        style={[styles.navBtn, { borderColor }]}
        onPress={() => sendToWeb({ action: 'prev' })}
        activeOpacity={0.85}>
        <MaterialIcons name="chevron-left" size={26} color={tintColor} />
        <ThemedText style={{ color: textColor, fontWeight: '700' }}>Prev</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.markBtn, { backgroundColor: tintColor }]}
        onPress={() => {
          void commitBookmarkAtLocation(true);
        }}
        activeOpacity={0.9}>
        <MaterialIcons name="bookmark" size={20} color="#000" />
        <ThemedText style={styles.markBtnText}>Mark</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navBtn, { borderColor }]}
        onPress={() => sendToWeb({ action: 'next' })}
        activeOpacity={0.85}>
        <ThemedText style={{ color: textColor, fontWeight: '700' }}>Next</ThemedText>
        <MaterialIcons name="chevron-right" size={26} color={tintColor} />
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedView style={[styles.wrap, { backgroundColor }]}>
      {!focusMode ? (
        <>
          {chromeTop}
          {readerError ? (
            <View style={[styles.errorBanner, { borderColor, backgroundColor: cardBgColor }]}>
              <ThemedText style={{ color: textColor, flex: 1 }} numberOfLines={3}>
                {readerError}
              </ThemedText>
              <TouchableOpacity onPress={() => setReaderError(null)} hitSlop={12}>
                <MaterialIcons name="close" size={20} color={mutedTextColor} />
              </TouchableOpacity>
            </View>
          ) : null}
          {controlsRow}
        </>
      ) : (
        <View
          style={[
            styles.focusOverlayTop,
            {
              paddingTop: Math.max(insets.top, 8),
              backgroundColor: colorScheme === 'dark' ? 'rgba(18,18,18,0.92)' : 'rgba(255,255,255,0.92)',
              borderBottomColor: borderColor,
            },
          ]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
            <MaterialIcons name="arrow-back" size={22} color={tintColor} />
          </TouchableOpacity>
          <ThemedText style={{ color: mutedTextColor, fontWeight: '700', flex: 1, textAlign: 'center' }}>
            {pctLabel}
          </ThemedText>
          <TouchableOpacity onPress={() => setShowToc(true)} style={styles.iconBtn} activeOpacity={0.85}>
            <MaterialIcons name="toc" size={22} color={tintColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowShelf(true)} style={styles.iconBtn} activeOpacity={0.85}>
            <MaterialIcons name="bookmark-add" size={22} color={tintColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => bumpFont(-0.1)} style={styles.iconBtn} activeOpacity={0.85}>
            <MaterialIcons name="remove" size={20} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => bumpFont(0.1)} style={styles.iconBtn} activeOpacity={0.85}>
            <MaterialIcons name="add" size={20} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn} activeOpacity={0.85}>
            <MaterialIcons
              name={reader.settings.readerTheme === 'dark' ? 'light-mode' : 'dark-mode'}
              size={20}
              color={textColor}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFocusMode(false)} style={styles.iconBtn} activeOpacity={0.85}>
            <MaterialIcons name="unfold-more" size={22} color={tintColor} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.reader}>
        {epubGate === 'blocked' ? (
          <View style={[styles.epubGatePanel, { backgroundColor }]}>
            <MaterialIcons name="error-outline" size={48} color={mutedTextColor} />
            <ThemedText style={[styles.epubGateTitle, { color: textColor }]}>Could not open EPUB</ThemedText>
            <ThemedText style={[styles.epubGateBody, { color: mutedTextColor }]} selectable>
              {epubGateDetail ?? 'Unknown error'}
            </ThemedText>
            <ThemedText style={[styles.epubGateUrl, { color: mutedTextColor }]} selectable numberOfLines={4}>
              {book.epubUrl}
            </ThemedText>
            <TouchableOpacity
              style={[styles.epubRetryBtn, { borderColor }]}
              onPress={() => {
                setReaderError(null);
                setEpubGateDetail(null);
                setEpubSessionKey((k) => k + 1);
              }}
              activeOpacity={0.85}>
              <ThemedText style={{ color: tintColor, fontWeight: '700' }}>Try again</ThemedText>
            </TouchableOpacity>
          </View>
        ) : epubGate === 'checking' ? (
          <View style={[styles.epubLoading, { backgroundColor }]}>
            <ActivityIndicator color={tintColor} />
            <ThemedText style={{ color: mutedTextColor, marginTop: 8 }}>Checking EPUB file…</ThemedText>
            <ThemedText
              style={{ color: mutedTextColor, marginTop: 6, fontSize: 12, textAlign: 'center', paddingHorizontal: 16 }}
              selectable
              numberOfLines={5}>
              {book.epubUrl}
            </ThemedText>
          </View>
        ) : (
          <>
            <EpubReaderWebView
              ref={webRef}
              sessionKey={epubSessionKey}
              epubUrl={book.epubUrl}
              initialStartCfi={initialCfi}
              onMessage={onWebMessage}
            />
            {!epubReady ? (
              <View style={[styles.epubLoading, { backgroundColor }]}>
                <ActivityIndicator color={tintColor} />
                <ThemedText style={{ color: mutedTextColor, marginTop: 8 }}>Preparing EPUB…</ThemedText>
                <ThemedText
                  style={{
                    color: mutedTextColor,
                    marginTop: 6,
                    fontSize: 11,
                    textAlign: 'center',
                    paddingHorizontal: 14,
                  }}
                  selectable
                  numberOfLines={4}>
                  {book.epubUrl}
                </ThemedText>
              </View>
            ) : null}
          </>
        )}
      </View>

      {focusMode ? (
        <View
          style={[
            styles.focusOverlayBottom,
            {
              paddingBottom: Math.max(insets.bottom, 10),
              backgroundColor: colorScheme === 'dark' ? 'rgba(18,18,18,0.92)' : 'rgba(255,255,255,0.92)',
              borderTopColor: borderColor,
            },
          ]}>
          <TouchableOpacity
            style={[styles.navBtn, { borderColor }]}
            onPress={() => sendToWeb({ action: 'prev' })}
            activeOpacity={0.85}>
            <MaterialIcons name="chevron-left" size={26} color={tintColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.markBtn, { backgroundColor: tintColor }]}
            onPress={() => {
              void commitBookmarkAtLocation(false);
            }}
            activeOpacity={0.9}>
            <MaterialIcons name="bookmark" size={20} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, { borderColor }]}
            onPress={() => sendToWeb({ action: 'next' })}
            activeOpacity={0.85}>
            <MaterialIcons name="chevron-right" size={26} color={tintColor} />
          </TouchableOpacity>
        </View>
      ) : (
        footer
      )}

      <Modal visible={showToc} animationType="slide" transparent onRequestClose={() => setShowToc(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold">Table of contents</ThemedText>
              <TouchableOpacity onPress={() => setShowToc(false)} activeOpacity={0.85}>
                <MaterialIcons name="close" size={22} color={mutedTextColor} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={toc}
              keyExtractor={(item) => `${item.href}-${item.label}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.tocRow}
                  onPress={() => {
                    sendToWeb({ action: 'goto_href', href: item.href });
                    setShowToc(false);
                  }}
                  activeOpacity={0.85}>
                  <ThemedText style={{ color: textColor }} numberOfLines={2}>
                    {item.label}
                  </ThemedText>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <ThemedText style={{ color: mutedTextColor }}>
                  TOC will appear after the book loads.
                </ThemedText>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showShelf} animationType="slide" transparent onRequestClose={() => setShowShelf(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCardBig, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold">Annotations</ThemedText>
              <TouchableOpacity onPress={() => setShowShelf(false)} activeOpacity={0.85}>
                <MaterialIcons name="close" size={22} color={mutedTextColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
              {(['bookmarks', 'highlights', 'notes'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.tab,
                    { borderColor },
                    annotationTab === t && { borderColor: tintColor },
                  ]}
                  onPress={() => setAnnotationTab(t)}
                  activeOpacity={0.85}>
                  <ThemedText style={{ color: annotationTab === t ? tintColor : mutedTextColor, fontWeight: '700' }}>
                    {t}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {annotationTab === 'bookmarks' ? (
              <FlatList
                data={bookmarks}
                keyExtractor={(b) => b.id}
                renderItem={({ item }) => (
                  <View style={[styles.noteCard, { borderColor }]}>
                    <ThemedText style={{ color: textColor }}>{item.label}</ThemedText>
                    <View style={styles.noteActions}>
                      <TouchableOpacity
                        onPress={() =>
                          item.location.startCfi && sendToWeb({ action: 'goto_cfi', cfi: item.location.startCfi })
                        }
                        activeOpacity={0.85}>
                        <ThemedText style={{ color: tintColor, fontWeight: '700' }}>Go</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void removeBookmarkPressed(item.id)}
                        activeOpacity={0.85}>
                        <MaterialIcons name="delete-outline" size={20} color={mutedTextColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <ThemedText style={{ color: mutedTextColor }}>No bookmarks yet.</ThemedText>
                }
              />
            ) : null}

            {annotationTab === 'highlights' ? (
              <FlatList
                data={highlights}
                keyExtractor={(h) => h.id}
                renderItem={({ item }) => (
                  <View style={[styles.noteCard, { borderColor }]}>
                    <ThemedText style={{ color: textColor }}>
                      {item.fallbackNote ?? `Highlight · ${item.location.startCfi ?? 'cfi pending'}`}
                    </ThemedText>
                    <View style={styles.noteActions}>
                      <TouchableOpacity
                        onPress={() =>
                          item.location.startCfi && sendToWeb({ action: 'goto_cfi', cfi: item.location.startCfi })
                        }
                        activeOpacity={0.85}>
                        <ThemedText style={{ color: tintColor, fontWeight: '700' }}>Go</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void removeHighlightPressed(item.id)}
                        activeOpacity={0.85}>
                        <MaterialIcons name="delete-outline" size={20} color={mutedTextColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListFooterComponent={
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor }]}
                    onPress={() => {
                      void commitHighlightAtLocation();
                    }}
                    activeOpacity={0.85}>
                    <ThemedText style={{ color: textColor, fontWeight: '700' }}>
                      Add highlight at current location
                    </ThemedText>
                  </TouchableOpacity>
                }
                ListEmptyComponent={
                  <ThemedText style={{ color: mutedTextColor }}>
                    Highlights attach to the current CFI; painted selection is not rendered in this WebView build.
                  </ThemedText>
                }
              />
            ) : null}

            {annotationTab === 'notes' ? (
              <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
                <ThemedTextInput
                  placeholder="Write a note for the current location…"
                  placeholderTextColor={mutedTextColor}
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  style={[styles.noteInput, { borderColor, color: textColor }]}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: tintColor }]}
                  onPress={() => {
                    void (async () => {
                      const cfi = lastAnchorRef.current.startCfi;
                      const body = noteDraft.trim();
                      if (!bookId || !cfi || !body) {
                        Alert.alert('Notes', 'Type a note after the page loads.');
                        return;
                      }
                      const location: EpubLocationRef = { ...lastAnchorRef.current, startCfi: cfi };
                      const st = useIgcsReaderStore.getState();
                      const tempId = st.addNote(bookId, { bookId, body, location });
                      if (!isBackendIgcsBookId(bookId)) {
                        setNoteDraft('');
                        return;
                      }
                      const remote = await saveNoteRemote({ bookId, body, location });
                      if (remote && tempId !== remote.id) {
                        st.replaceNote(bookId, tempId, remote);
                      }
                      if (!remote) {
                        Alert.alert(
                          'Notes',
                          'Saved on this device; could not sync to your account (offline or server error).'
                        );
                      } else {
                        setNoteDraft('');
                      }
                    })();
                  }}
                  activeOpacity={0.9}>
                  <ThemedText style={styles.primaryBtnText}>Save note</ThemedText>
                </TouchableOpacity>

                {notes.map((n) => (
                  <View key={n.id} style={[styles.noteCard, { borderColor }]}>
                    <ThemedText style={{ color: textColor }}>{n.body}</ThemedText>
                    <View style={styles.noteActions}>
                      <TouchableOpacity
                        onPress={() =>
                          n.location.startCfi && sendToWeb({ action: 'goto_cfi', cfi: n.location.startCfi })
                        }
                        activeOpacity={0.85}>
                        <ThemedText style={{ color: tintColor, fontWeight: '700' }}>Go</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void removeNotePressed(n.id)}
                        activeOpacity={0.85}>
                        <MaterialIcons name="delete-outline" size={20} color={mutedTextColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarTitle: { fontWeight: '700' },
  iconBtn: { padding: 8 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallBtn: {
    width: 40,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reader: { flex: 1 },
  epubLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epubGatePanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  epubGateTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  epubGateBody: { fontSize: 14, textAlign: 'center' },
  epubGateUrl: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  epubRetryBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  focusOverlayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  focusOverlayBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  markBtnText: { color: '#000', fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  modalCard: {
    maxHeight: '62%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  modalCardBig: {
    height: '78%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tocRow: { paddingVertical: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  noteCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '800' },
  secondaryBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
});
