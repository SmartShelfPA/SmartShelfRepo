import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import type { IgcseCatalogSubject } from '@/src/types/igcseCatalog';

type Props = {
  subject: IgcseCatalogSubject;
  onPress: () => void;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  borderColor: string;
  cardBg: string;
};

export function IgcseSubjectCard({
  subject,
  onPress,
  textColor,
  mutedColor,
  tintColor,
  borderColor,
  cardBg,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderColor, backgroundColor: cardBg }]}
      activeOpacity={0.88}
      onPress={onPress}>
      <MaterialIcons name="science" size={22} color={tintColor} />
      <View style={{ flex: 1 }}>
        <ThemedText style={{ color: textColor, fontWeight: '800' }}>{subject.title}</ThemedText>
        <ThemedText style={{ color: mutedColor, fontSize: 12 }}>{subject.id}</ThemedText>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={mutedColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
});
