import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { HtmlContent } from '@/src/components/practice/HtmlContent';
import { IgcseDifficultyBadge } from '@/src/components/igcse/IgcseDifficultyBadge';
import type { IgcseTheoryNormalized } from '@/src/types/igcseNormalized';

type Props = {
  theory: IgcseTheoryNormalized;
  revealed: boolean;
  onToggleReveal: () => void;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  borderColor: string;
  cardBg: string;
};

export function IgcseTheoryPracticeCard({
  theory,
  revealed,
  onToggleReveal,
  textColor,
  mutedColor,
  tintColor,
  borderColor,
  cardBg,
}: Props) {
  const uri = theory.image_url?.trim();
  const showImage = Boolean(uri && (uri.startsWith('http://') || uri.startsWith('https://')));

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.rowBetween}>
          <ThemedText style={[styles.label, { color: mutedColor }]}>Theory</ThemedText>
          <IgcseDifficultyBadge
            difficulty={theory.difficulty}
            tintColor={tintColor}
            mutedColor={mutedColor}
            borderColor={borderColor}
            cardBg={cardBg}
          />
        </View>
        {theory.intro ? (
          <ThemedText style={{ color: textColor, fontSize: 15, lineHeight: 22 }}>{theory.intro}</ThemedText>
        ) : null}
        {theory.statements.length > 0 ? (
          <View style={{ gap: 6 }}>
            {theory.statements.map((s, i) => (
              <View key={`${i}-${s.slice(0, 24)}`} style={styles.statementRow}>
                <MaterialIcons name="fiber-manual-record" size={10} color={tintColor} />
                <ThemedText style={{ color: textColor, flex: 1, fontSize: 14, lineHeight: 20 }}>{s}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        {showImage ? (
          <Image source={{ uri: uri! }} style={styles.image} contentFit="contain" accessibilityLabel="Diagram" />
        ) : null}
        <ThemedText style={[styles.label, { color: mutedColor }]}>Question</ThemedText>
        <HtmlContent html={theory.prompt_html || `<p>${theory.question}</p>`} color={textColor} />
      </View>

      <TouchableOpacity
        style={[styles.revealBtn, { borderColor }]}
        onPress={onToggleReveal}
        activeOpacity={0.85}>
        <MaterialIcons name="visibility" size={18} color={textColor} />
        <ThemedText style={{ color: textColor, fontWeight: '800' }}>
          {revealed ? 'Hide marking guidance' : 'Reveal marking guidance'}
        </ThemedText>
      </TouchableOpacity>

      {revealed ? (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <ThemedText style={[styles.label, { color: mutedColor }]}>Scheme</ThemedText>
          {theory.scheme.length > 0 ? (
            <View style={{ gap: 4 }}>
              {theory.scheme.map((line, i) => (
                <ThemedText key={`${i}-${line.slice(0, 32)}`} style={{ color: textColor, fontSize: 14 }}>
                  • {line}
                </ThemedText>
              ))}
            </View>
          ) : (
            <ThemedText style={{ color: mutedColor, fontSize: 14 }}>No scheme lines provided.</ThemedText>
          )}
          <ThemedText style={[styles.label, { color: mutedColor, marginTop: 10 }]}>Explanation</ThemedText>
          {theory.explanation_html ? (
            <HtmlContent html={theory.explanation_html} color={textColor} />
          ) : theory.explanation ? (
            <ThemedText style={{ color: textColor, fontSize: 15, lineHeight: 22 }}>{theory.explanation}</ThemedText>
          ) : (
            <ThemedText style={{ color: mutedColor, fontSize: 14 }}>No explanation provided.</ThemedText>
          )}
        </View>
      ) : null}
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  image: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#00000014' },
  revealBtn: {
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
