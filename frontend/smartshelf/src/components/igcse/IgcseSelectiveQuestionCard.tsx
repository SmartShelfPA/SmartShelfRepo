import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { HtmlContent } from '@/src/components/practice/HtmlContent';
import type { NormalizedQuestion, NormalizedAnswerOption } from '@/src/types/practice';

type Props = {
  question: NormalizedQuestion;
  selectedOptionId: string | undefined;
  reveal: boolean;
  finished: boolean;
  onSelectOption: (optionId: string) => void;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  borderColor: string;
  cardBg: string;
};

function OptionRow({
  opt,
  selected,
  showStates,
  isCorrect,
  onPress,
  disabled,
  textColor,
  tintColor,
  borderColor,
  cardBg,
}: {
  opt: NormalizedAnswerOption;
  selected: boolean;
  showStates: boolean;
  isCorrect: boolean;
  onPress: () => void;
  disabled: boolean;
  textColor: string;
  tintColor: string;
  borderColor: string;
  cardBg: string;
}) {
  const border =
    showStates && isCorrect
      ? tintColor
      : showStates && selected && !isCorrect
        ? '#FF5252'
        : selected
          ? tintColor
          : borderColor;
  return (
    <TouchableOpacity
      style={[styles.option, { borderColor: border, backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}>
      <View style={styles.optionRow}>
        <View style={[styles.badge, { borderColor }]}>
          <ThemedText style={{ color: textColor, fontWeight: '900' }}>{opt.id}</ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <HtmlContent html={opt.labelHtml} color={textColor} />
        </View>
        {showStates && isCorrect ? <MaterialIcons name="check-circle" size={20} color={tintColor} /> : null}
      </View>
    </TouchableOpacity>
  );
}

export function IgcseSelectiveQuestionCard({
  question,
  selectedOptionId,
  reveal,
  finished,
  onSelectOption,
  textColor,
  mutedColor: _mutedColor,
  tintColor,
  borderColor,
  cardBg,
}: Props) {
  const showStates = reveal || finished;
  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <ThemedText style={[styles.label, { color: _mutedColor }]}>Multiple choice</ThemedText>
        <HtmlContent html={question.promptHtml} color={textColor} />
      </View>
      {question.options.map((opt) => {
        const selected = selectedOptionId === opt.id;
        const isCorrect = opt.id === question.correctOptionId;
        return (
          <OptionRow
            key={opt.id}
            opt={opt}
            selected={selected}
            showStates={showStates}
            isCorrect={isCorrect}
            onPress={() => onSelectOption(opt.id)}
            disabled={finished}
            textColor={textColor}
            tintColor={tintColor}
            borderColor={borderColor}
            cardBg={cardBg}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 12,
    gap: 10,
  },
  label: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  option: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 12,
  },
  optionRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
