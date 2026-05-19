import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import type { IgcseSearchHit } from '@/src/types/igcseNormalized';

type Props = {
  hit: IgcseSearchHit;
  onPress: () => void;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  borderColor: string;
  cardBg: string;
};

export function IgcseSearchHitCard({
  hit,
  onPress,
  textColor,
  mutedColor,
  tintColor,
  borderColor,
  cardBg,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, { borderColor, backgroundColor: cardBg }]}
      activeOpacity={0.88}
      onPress={onPress}>
      <View style={styles.hitTop}>
        <MaterialIcons name={hit.is_topic ? 'category' : 'folder'} size={22} color={tintColor} />
        <View style={{ flex: 1 }}>
          <ThemedText style={{ color: textColor, fontWeight: '800' }}>{hit.title}</ThemedText>
          <ThemedText style={{ color: mutedColor, fontSize: 12 }}>{hit.slug}</ThemedText>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={mutedColor} />
      </View>
      {hit.excerpt ? (
        <ThemedText style={{ color: mutedColor, fontSize: 13, marginTop: 8 }} numberOfLines={5}>
          {hit.excerpt}
        </ThemedText>
      ) : null}
      {hit.path ? (
        <ThemedText style={{ color: tintColor, fontSize: 11, marginTop: 6 }} numberOfLines={2}>
          {hit.path}
        </ThemedText>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  hitTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
