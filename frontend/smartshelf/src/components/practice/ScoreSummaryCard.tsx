import { Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

type Props = {
  scorePercent: number;
  correct: number;
  total: number;
  tintColor: string;
  textColor: string;
  mutedColor: string;
  cardBg: string;
  borderColor: string;
};

export function ScoreSummaryCard({
  scorePercent,
  correct,
  total,
  tintColor,
  textColor,
  mutedColor,
  cardBg,
  borderColor,
}: Props) {
  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <ThemedText style={[styles.title, { color: textColor }]} type="defaultSemiBold">
        Session summary
      </ThemedText>
      <ThemedText
        style={[styles.big, { color: tintColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}>
        {Math.round(scorePercent)}%
      </ThemedText>
      <ThemedText style={[styles.meta, { color: mutedColor }]}>
        {correct} / {total} correct
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 18,
    gap: 12,
    alignItems: 'center',
  },
  title: { fontSize: 14 },
  big: {
    fontSize: 44,
    lineHeight: 54,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : {}),
  },
  meta: { fontSize: 13 },
});
