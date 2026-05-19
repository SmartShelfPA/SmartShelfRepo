import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';

type Props = {
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  borderColor: string;
  cardBg: string;
};

export function IgcseShelfTile({
  title,
  description,
  icon,
  onPress,
  textColor,
  mutedColor,
  tintColor,
  borderColor,
  cardBg,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderColor }]}
      activeOpacity={0.88}
      onPress={onPress}>
      <View style={[styles.iconWrap, { borderColor }]}>
        <MaterialIcons name={icon} size={26} color={tintColor} />
      </View>
      <ThemedText style={[styles.cardTitle, { color: textColor }]}>{title}</ThemedText>
      <ThemedText style={[styles.cardBody, { color: mutedColor }]}>{description}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardBody: { fontSize: 14, lineHeight: 20 },
});
