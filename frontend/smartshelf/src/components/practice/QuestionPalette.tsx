import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

export type PaletteStatus = 'todo' | 'done' | 'current';

type Props = {
  total: number;
  currentIndex: number;
  answered: Set<number>;
  onSelect: (index: number) => void;
  tintColor: string;
  mutedColor: string;
  cardBg: string;
  borderColor: string;
};

export function QuestionPalette({
  total,
  currentIndex,
  answered,
  onSelect,
  tintColor,
  mutedColor,
  cardBg,
  borderColor,
}: Props) {
  const items = Array.from({ length: total }, (_, i) => i);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((idx) => {
          const status: PaletteStatus =
            idx === currentIndex ? 'current' : answered.has(idx) ? 'done' : 'todo';
          const border =
            status === 'current' ? tintColor : answered.has(idx) ? tintColor : borderColor;
          const bg = status === 'current' ? `${tintColor}22` : cardBg;
          const color = status === 'todo' ? mutedColor : tintColor;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.chip, { borderColor: border, backgroundColor: bg }]}
              onPress={() => onSelect(idx)}
              activeOpacity={0.85}>
              <ThemedText style={[styles.chipText, { color }]} type="defaultSemiBold">
                {idx + 1}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  row: { gap: 8, paddingHorizontal: 4 },
  chip: {
    minWidth: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chipText: { fontSize: 13 },
});
