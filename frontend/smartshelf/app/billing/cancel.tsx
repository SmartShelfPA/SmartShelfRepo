import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function BillingCancelScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText style={styles.title} type="defaultSemiBold">
          Checkout cancelled
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          No charge was made. You can choose a plan again from Profile → Prices.
        </ThemedText>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/profile')}>
          <ThemedText style={styles.buttonText}>Back to profile</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 320,
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.75,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#00FF41',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
});
