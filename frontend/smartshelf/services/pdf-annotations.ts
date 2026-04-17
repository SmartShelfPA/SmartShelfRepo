import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@smartshelf:pdf_annotations:';

export type PdfAnnotation =
  | {
      id: string;
      page: number;
      type: 'highlight';
      left: number;
      top: number;
      width: number;
      height: number;
      color?: string;
    }
  | {
      id: string;
      page: number;
      type: 'sticky';
      left: number;
      top: number;
      width: number;
      height: number;
      text?: string;
      color?: string;
    }
  | {
      id: string;
      page: number;
      type: 'draw';
      path: Array<{ x: number; y: number }>; // 0-1 relative coords
      color?: string;
    };

function storageKey(pdfUrl: string): string {
  return `${STORAGE_PREFIX}${pdfUrl}`;
}

export async function getAnnotations(pdfUrl: string): Promise<PdfAnnotation[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(pdfUrl));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAnnotations(
  pdfUrl: string,
  annotations: PdfAnnotation[]
): Promise<void> {
  await AsyncStorage.setItem(storageKey(pdfUrl), JSON.stringify(annotations));
}

export async function addAnnotation(
  pdfUrl: string,
  annotation: Omit<PdfAnnotation, 'id'>
): Promise<PdfAnnotation> {
  const existing = await getAnnotations(pdfUrl);
  const newAnnotation = {
    ...annotation,
    id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  } as PdfAnnotation;
  const updated = [...existing, newAnnotation];
  await saveAnnotations(pdfUrl, updated);
  return newAnnotation;
}
