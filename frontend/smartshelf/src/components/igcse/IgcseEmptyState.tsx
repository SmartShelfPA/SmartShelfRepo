import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';

type Props = {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  mutedColor: string;
  tintColor: string;
};

export function IgcseEmptyState({
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
  mutedColor,
  tintColor,
}: Props) {
  return (
    <View style={styles.wrap}>
      <MaterialIcons name={icon} size={44} color={mutedColor} />
      {title ? (
        <ThemedText style={[styles.title, { color: mutedColor }]}>{title}</ThemedText>
      ) : null}
      <ThemedText style={[styles.message, { color: mutedColor }]}>{message}</ThemedText>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.85}>
          <ThemedText style={{ color: tintColor, fontWeight: '800' }}>{actionLabel}</ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  title: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
