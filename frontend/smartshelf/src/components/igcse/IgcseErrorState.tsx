import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';

type Props = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  mutedColor: string;
  tintColor: string;
};

export function IgcseErrorState({
  message,
  onRetry,
  retryLabel = 'Retry',
  mutedColor,
  tintColor,
}: Props) {
  return (
    <View style={styles.wrap}>
      <MaterialIcons name="error-outline" size={40} color={mutedColor} />
      <ThemedText style={[styles.message, { color: mutedColor }]}>{message}</ThemedText>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} activeOpacity={0.85}>
          <ThemedText style={{ color: tintColor, fontWeight: '800' }}>{retryLabel}</ThemedText>
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
    gap: 12,
    padding: 24,
  },
  message: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
