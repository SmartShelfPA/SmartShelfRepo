import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

type Props = {
  difficulty: number;
  tintColor: string;
  mutedColor: string;
  borderColor: string;
  cardBg: string;
};

export function IgcseDifficultyBadge({
  difficulty,
  tintColor,
  mutedColor,
  borderColor,
  cardBg,
}: Props) {
  const d = Math.max(0, Math.min(3, Math.floor(difficulty)));
  return (
    <View style={[styles.wrap, { borderColor, backgroundColor: cardBg }]}>
      <ThemedText style={[styles.label, { color: mutedColor }]}>Difficulty</ThemedText>
      <ThemedText style={[styles.value, { color: tintColor }]}>{d}/3</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  value: { fontSize: 13, fontWeight: '900' },
});
