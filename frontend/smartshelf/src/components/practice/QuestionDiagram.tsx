import { useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';

const EMPTY = new Set(['', 'null', 'none', 'n/a', 'nil', 'undefined']);

/** Keep a remote figure, a data-uri image, or a plain SVG. Drops anything else. */
export function cleanDiagramUrl(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw || EMPTY.has(raw.toLowerCase())) return '';
  const lower = raw.toLowerCase();
  if (lower.startsWith('<svg') && lower.endsWith('</svg>') && raw.length <= 8000) {
    if (/<script|javascript:|on\w+\s*=/i.test(raw)) return '';
    return raw;
  }
  const url = raw.startsWith('//') ? `https:${raw}` : raw;
  if (/^https?:\/\//i.test(url) && url.length <= 2000) return url;
  if (lower.startsWith('data:image/') && raw.length <= 8000) return raw;
  return '';
}

export function diagramFromHtml(html: string | undefined): string {
  if (!html) return '';
  const match = /<img\b[^>]*\ssrc=["']([^"']+)["']/i.exec(html);
  return cleanDiagramUrl(match?.[1] ?? '');
}

/** Figure that belongs with a question. Skips a URL the prompt HTML already shows. */
export function QuestionDiagram({ uri, prompt }: { uri?: string | null; prompt?: string }) {
  const { width } = useWindowDimensions();
  const value = cleanDiagramUrl(uri);
  if (!value) return null;
  if (prompt && /^https?:\/\//i.test(value) && prompt.includes(value)) return null;

  const frameWidth = Math.max(220, Math.min(width - 64, 480));
  if (value.startsWith('<svg')) {
    return (
      <View style={styles.frame} accessibilityLabel="Diagram for this question">
        <SvgXml xml={value} width={frameWidth} height={200} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: value }}
      style={[styles.image, { width: frameWidth }]}
      contentFit="contain"
      accessibilityLabel="Diagram for this question"
    />
  );
}

const styles = {
  frame: {
    alignSelf: 'stretch' as const,
    alignItems: 'center' as const,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    overflow: 'hidden' as const,
  },
  image: {
    alignSelf: 'stretch' as const,
    height: 200,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
};
