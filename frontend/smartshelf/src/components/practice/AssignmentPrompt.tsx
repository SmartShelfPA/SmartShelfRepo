import { View, type TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import { QuestionDiagram } from '@/src/components/practice/QuestionDiagram';
import { RichPrompt } from '@/src/components/practice/RichPrompt';

/** Past-paper citations stored on a question, e.g. "WAEC Mathematics 2011". */
export function paperSourceLabel(label?: string | null): string | undefined {
  const value = (label ?? '').trim();
  return /^(WAEC|JAMB)\b/.test(value) ? value : undefined;
}

/** Question wording plus its figure, for students and teachers. */
export function AssignmentPrompt({
  prompt,
  diagramUrl,
  source,
  color,
  textStyle,
}: {
  prompt: string;
  diagramUrl?: string | null;
  source?: string;
  color: string;
  textStyle?: TextStyle;
}) {
  return (
    <View style={{ gap: 8 }}>
      {source ? <ThemedText style={{ fontSize: 12, fontWeight: '700' }}>{source}</ThemedText> : null}
      <QuestionDiagram uri={diagramUrl} prompt={prompt} />
      <RichPrompt value={prompt} color={color} textStyle={textStyle} />
    </View>
  );
}
