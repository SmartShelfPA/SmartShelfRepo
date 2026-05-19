import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

type Props = {
  message?: string;
  tintColor: string;
  mutedColor: string;
};

export function IgcseListSkeleton({ message = 'Loading…', tintColor, mutedColor }: Props) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={tintColor} />
      <ThemedText style={{ color: mutedColor }}>{message}</ThemedText>
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
});
