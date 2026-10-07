import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Pdf from 'react-native-pdf';
import Svg, { Circle, G, Polyline } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useThemeColor } from '@/hooks/use-theme-color';
import {
  ANNOTATION_COLORS,
  HIGHLIGHT_OPACITY,
  HIGHLIGHT_WIDTH,
  NOTE_COLOR,
  PEN_WIDTH,
  annotationHit,
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  simplifyStroke,
  updateAnnotation,
  type PdfAnnotation,
} from '@/src/api/annotations';

type Tool = 'read' | 'pen' | 'highlight' | 'note' | 'erase';
type Point = [number, number];
type DraftStroke = Pick<PdfAnnotation, 'kind' | 'color' | 'width'> & { points: Point[] };
type NoteEdit = { annotation?: PdfAnnotation; point?: Point; text: string };

const TOOLS: { id: Tool; icon: keyof typeof MaterialIcons.glyphMap; label: string }[] = [
  { id: 'read', icon: 'pan-tool', label: 'Move' },
  { id: 'pen', icon: 'edit', label: 'Pen' },
  { id: 'highlight', icon: 'border-color', label: 'Highlight' },
  { id: 'note', icon: 'sticky-note-2', label: 'Notes' },
  { id: 'erase', icon: 'auto-fix-normal', label: 'Eraser' },
];

function pointsAttr(points: Point[], ratio: number) {
  return points.map(([x, y]) => `${x.toFixed(4)},${(y * ratio).toFixed(4)}`).join(' ');
}

/** Page-by-page notes mode: pen, highlighter, sticky notes and eraser, saved to the student's account. */
export default function AnnotatePdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const text = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');
  const { localUri, bookId, title, page: pageParam } = useLocalSearchParams<{
    localUri: string;
    bookId: string;
    title?: string;
    page?: string;
  }>();

  const [page, setPage] = useState(Math.max(1, Number(pageParam) || 1));
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [draft, setDraft] = useState<DraftStroke | null>(null);
  const [status, setStatus] = useState('');
  const [noteEdit, setNoteEdit] = useState<NoteEdit | null>(null);

  const draftRef = useRef<DraftStroke | null>(null);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const annotationsRef = useRef(annotations);
  const pageRef = useRef(page);
  toolRef.current = tool;
  colorRef.current = color;
  annotationsRef.current = annotations;
  pageRef.current = page;

  const ratio = pageSize ? pageSize.height / pageSize.width : 1.414;

  /** Where the page sits inside the PDF view (fit-both, centred). */
  const pageRect = useMemo(() => {
    if (!box) return null;
    const scale = Math.min(box.width, box.height / ratio);
    const width = scale;
    const height = scale * ratio;
    return { width, height, left: (box.width - width) / 2, top: (box.height - height) / 2 };
  }, [box, ratio]);
  const rectRef = useRef(pageRect);
  rectRef.current = pageRect;

  useEffect(() => {
    if (!bookId) return;
    let active = true;
    setAnnotations([]);
    listAnnotations(bookId, page)
      .then((items) => active && setAnnotations(items))
      .catch((e) => active && setStatus(e instanceof Error ? e.message : 'Notes unavailable'));
    return () => {
      active = false;
    };
  }, [bookId, page]);

  const saveNew = useCallback(
    async (input: DraftStroke & { text?: string }) => {
      if (!bookId) return;
      const tempId = `tmp-${Date.now()}`;
      const temp: PdfAnnotation = {
        id: tempId,
        page: pageRef.current,
        kind: input.kind,
        color: input.color,
        width: input.width,
        points: input.points,
        text: input.text ?? '',
        created_at: '',
        updated_at: '',
      };
      setAnnotations((prev) => [...prev, temp]);
      setStatus('Saving…');
      try {
        const saved = await createAnnotation(bookId, {
          page: temp.page,
          kind: temp.kind,
          color: temp.color,
          width: temp.width,
          points: temp.points,
          text: temp.text,
        });
        setAnnotations((prev) => prev.map((a) => (a.id === tempId ? saved : a)));
        setStatus('Saved');
      } catch (e) {
        setAnnotations((prev) => prev.filter((a) => a.id !== tempId));
        setStatus(e instanceof Error ? `Not saved: ${e.message}` : 'Not saved');
      }
    },
    [bookId]
  );

  const remove = useCallback(
    async (a: PdfAnnotation) => {
      if (!bookId) return;
      setAnnotations((prev) => prev.filter((x) => x.id !== a.id));
      if (a.id.startsWith('tmp-')) return;
      try {
        await deleteAnnotation(bookId, a.id);
        setStatus('Saved');
      } catch (e) {
        setAnnotations((prev) => [...prev, a]);
        setStatus(e instanceof Error ? `Not deleted: ${e.message}` : 'Not deleted');
      }
    },
    [bookId]
  );

  const removeRef = useRef(remove);
  removeRef.current = remove;
  const saveRef = useRef(saveNew);
  saveRef.current = saveNew;

  const toPoint = (x: number, y: number): Point | null => {
    const r = rectRef.current;
    if (!r) return null;
    return [Math.min(1, Math.max(0, x / r.width)), Math.min(1, Math.max(0, y / r.height))];
  };

  const eraseAt = (p: Point) => {
    annotationsRef.current.filter((a) => annotationHit(a, p)).forEach((a) => void removeRef.current(a));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => toolRef.current !== 'read',
        onMoveShouldSetPanResponder: () => toolRef.current !== 'read',
        onPanResponderGrant: (evt) => {
          const p = toPoint(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          if (!p) return;
          const current = toolRef.current;
          if (current === 'note') {
            const existing = annotationsRef.current.find((a) => a.kind === 'note' && annotationHit(a, p));
            setNoteEdit(existing ? { annotation: existing, text: existing.text } : { point: p, text: '' });
            return;
          }
          if (current === 'erase') {
            eraseAt(p);
            return;
          }
          const isHighlight = current === 'highlight';
          const stroke: DraftStroke = {
            kind: isHighlight ? 'highlight' : 'pen',
            color: isHighlight && colorRef.current === ANNOTATION_COLORS[0] ? '#FFEB3B' : colorRef.current,
            width: isHighlight ? HIGHLIGHT_WIDTH : PEN_WIDTH,
            points: [p],
          };
          draftRef.current = stroke;
          setDraft(stroke);
        },
        onPanResponderMove: (evt) => {
          const p = toPoint(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          if (!p) return;
          if (toolRef.current === 'erase') {
            eraseAt(p);
            return;
          }
          const stroke = draftRef.current;
          if (!stroke) return;
          const last = stroke.points[stroke.points.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return;
          const next = { ...stroke, points: [...stroke.points, p] };
          draftRef.current = next;
          setDraft(next);
        },
        onPanResponderRelease: () => {
          const stroke = draftRef.current;
          draftRef.current = null;
          setDraft(null);
          if (!stroke) return;
          const points = simplifyStroke(stroke.points);
          if (points.length >= 2) void saveRef.current({ ...stroke, points });
        },
        onPanResponderTerminate: () => {
          draftRef.current = null;
          setDraft(null);
        },
      }),
    // toPoint/eraseAt read refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const saveNote = async () => {
    const edit = noteEdit;
    setNoteEdit(null);
    if (!edit || !bookId) return;
    const value = edit.text.trim();
    if (edit.annotation) {
      if (!value) return void remove(edit.annotation);
      if (value === edit.annotation.text) return;
      try {
        const saved = await updateAnnotation(bookId, edit.annotation.id, { text: value });
        setAnnotations((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
        setStatus('Saved');
      } catch (e) {
        Alert.alert('Not saved', e instanceof Error ? e.message : 'Try again.');
      }
      return;
    }
    if (value && edit.point) {
      void saveNew({ kind: 'note', color: NOTE_COLOR, width: 0.01, points: [edit.point], text: value });
    }
  };

  const onBoxLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  };

  if (!localUri || !bookId) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={{ color: text }}>Open a downloaded PDF first.</Text>
      </View>
    );
  }

  const drawing = tool !== 'read';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: text + '22' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Back">
          <MaterialIcons name="arrow-back" size={24} color={text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: text }]} numberOfLines={1}>
            {title ?? 'Notes'}
          </Text>
          <Text style={[styles.status, { color: text + '99' }]} numberOfLines={1}>
            {status || 'Notes are private to your account'}
          </Text>
        </View>
        <TouchableOpacity
          disabled={page <= 1}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          style={[styles.iconBtn, page <= 1 && { opacity: 0.3 }]}
          accessibilityLabel="Previous page">
          <MaterialIcons name="chevron-left" size={26} color={text} />
        </TouchableOpacity>
        <Text style={[styles.pageLabel, { color: text }]}>
          {page}
          {totalPages ? ` / ${totalPages}` : ''}
        </Text>
        <TouchableOpacity
          disabled={!!totalPages && page >= totalPages}
          onPress={() => setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p + 1))}
          style={[styles.iconBtn, !!totalPages && page >= totalPages && { opacity: 0.3 }]}
          accessibilityLabel="Next page">
          <MaterialIcons name="chevron-right" size={26} color={text} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        {TOOLS.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTool(t.id)}
            style={[styles.tool, tool === t.id && styles.toolActive]}
            accessibilityLabel={t.label}>
            <MaterialIcons name={t.icon} size={20} color={tool === t.id ? '#000' : text} />
            <Text style={[styles.toolLabel, { color: tool === t.id ? '#000' : text }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tool === 'pen' || tool === 'highlight' ? (
        <View style={styles.swatches}>
          {ANNOTATION_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
              accessibilityLabel={`Colour ${c}`}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.pdfBox} onLayout={onBoxLayout}>
        <Pdf
          source={{ uri: localUri }}
          page={page}
          enablePaging
          horizontal
          spacing={0}
          fitPolicy={2}
          minScale={1}
          maxScale={1}
          scrollEnabled={!drawing}
          onLoadComplete={(pages, _path, size) => {
            setTotalPages(pages);
            if (size?.width && size?.height) setPageSize({ width: size.width, height: size.height });
          }}
          onPageChanged={(p) => {
            if (p !== pageRef.current) setPage(p);
          }}
          onError={(err) => setStatus(err instanceof Error ? err.message : 'Could not open PDF')}
          style={[styles.pdf, { backgroundColor: bg }]}
          trustAllCerts={false}
        />
        {!pageSize ? (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <ActivityIndicator color="#00FF41" />
          </View>
        ) : null}
        {pageRect && pageSize ? (
          <View
            {...responder.panHandlers}
            pointerEvents={drawing ? 'auto' : 'none'}
            style={[
              styles.overlay,
              { left: pageRect.left, top: pageRect.top, width: pageRect.width, height: pageRect.height },
            ]}>
            <Svg width="100%" height="100%" viewBox={`0 0 1 ${ratio}`} preserveAspectRatio="none">
              {annotations.map((a) =>
                a.kind === 'note' ? (
                  <G key={a.id}>
                    <Circle
                      cx={a.points[0]?.[0] ?? 0}
                      cy={(a.points[0]?.[1] ?? 0) * ratio}
                      r={0.02}
                      fill={NOTE_COLOR}
                      stroke="#5d4300"
                      strokeWidth={0.003}
                    />
                  </G>
                ) : (
                  <Polyline
                    key={a.id}
                    points={pointsAttr(a.points, ratio)}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={a.width}
                    strokeOpacity={a.kind === 'highlight' ? HIGHLIGHT_OPACITY : 1}
                    strokeLinecap={a.kind === 'highlight' ? 'butt' : 'round'}
                    strokeLinejoin="round"
                  />
                )
              )}
              {draft ? (
                <Polyline
                  points={pointsAttr(draft.points, ratio)}
                  fill="none"
                  stroke={draft.color}
                  strokeWidth={draft.width}
                  strokeOpacity={draft.kind === 'highlight' ? HIGHLIGHT_OPACITY : 1}
                  strokeLinecap={draft.kind === 'highlight' ? 'butt' : 'round'}
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
          </View>
        ) : null}
      </View>

      <Modal visible={!!noteEdit} transparent animationType="fade" onRequestClose={() => setNoteEdit(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: bg }]}>
            <Text style={[styles.title, { color: text }]}>{noteEdit?.annotation ? 'Your note' : 'New note'}</Text>
            <TextInput
              value={noteEdit?.text ?? ''}
              onChangeText={(v) => setNoteEdit((prev) => (prev ? { ...prev, text: v } : prev))}
              placeholder="Write your note"
              placeholderTextColor={text + '77'}
              multiline
              autoFocus
              style={[styles.noteInput, { color: text, borderColor: text + '33' }]}
            />
            <View style={styles.modalActions}>
              {noteEdit?.annotation ? (
                <TouchableOpacity
                  onPress={() => {
                    const a = noteEdit.annotation;
                    setNoteEdit(null);
                    if (a) void remove(a);
                  }}
                  style={{ marginRight: 'auto' }}>
                  <Text style={{ color: '#e53935', fontWeight: '700' }}>Delete</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setNoteEdit(null)}>
                <Text style={{ color: text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void saveNote()} style={styles.saveBtn}>
                <Text style={{ color: '#000', fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  iconBtn: { padding: 6 },
  title: { fontSize: 15, fontWeight: '700' },
  status: { fontSize: 11 },
  pageLabel: { fontSize: 13, minWidth: 54, textAlign: 'center' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 4 },
  tool: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, gap: 2 },
  toolActive: { backgroundColor: '#00FF41' },
  toolLabel: { fontSize: 11, fontWeight: '600' },
  swatches: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingBottom: 8 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#888' },
  swatchActive: { borderColor: '#00FF41', transform: [{ scale: 1.15 }] },
  pdfBox: { flex: 1, position: 'relative' },
  pdf: { flex: 1 },
  overlay: { position: 'absolute' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 14, padding: 16, gap: 12 },
  noteInput: { minHeight: 120, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top', fontSize: 15 },
  modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 18 },
  saveBtn: { backgroundColor: '#00FF41', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
});
