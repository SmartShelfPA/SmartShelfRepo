import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';

type Props = {
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  borderColor: string;
  cardBg: string;
};

export function IgcseStudyResourceCard({
  title,
  description,
  icon,
  onPress,
  disabled = false,
  textColor,
  mutedColor,
  tintColor,
  borderColor,
  cardBg,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderColor, backgroundColor: cardBg, opacity: disabled ? 0.45 : 1 },
      ]}
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}>
      <View style={[styles.iconWrap, { borderColor }]}>
        <MaterialIcons name={icon} size={28} color={tintColor} />
      </View>
      <View style={styles.body}>
        <ThemedText style={[styles.title, { color: textColor }]}>{title}</ThemedText>
        <ThemedText style={{ color: mutedColor, fontSize: 13, lineHeight: 18 }}>{description}</ThemedText>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={mutedColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  title: { fontWeight: '800', fontSize: 16 },
});
