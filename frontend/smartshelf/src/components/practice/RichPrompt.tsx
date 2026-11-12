import { ThemedText } from '@/components/themed-text';
import type { TextStyle } from 'react-native';

import { HtmlContent } from '@/src/components/practice/HtmlContent';

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value ?? '');
}

/** Renders a past-question prompt or option, whether it is plain text or HTML. */
export function RichPrompt({
  value,
  color,
  textStyle,
}: {
  value: string;
  color: string;
  textStyle?: TextStyle;
}) {
  if (looksLikeHtml(value)) return <HtmlContent html={value} color={color} />;
  return <ThemedText style={[{ color }, textStyle]}>{value}</ThemedText>;
}
