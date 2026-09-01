import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { refreshBilling } from '@/src/api/billing';
import { useAuthStore } from '@/src/store/auth';

export default function BillingSuccessScreen() {
  const router = useRouter();
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  useEffect(() => {
    let cancelled = false;
    const finish = async () => {
      try {
        await refreshBilling();
        await refreshProfile();
      } catch {
        // Webhook may still be processing; profile refresh on next open is fine.
      }
      if (!cancelled) {
        router.replace('/(tabs)/profile');
      }
    };
    void finish();
    return () => {
      cancelled = true;
    };
  }, [refreshProfile, router]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#00FF41" />
        <ThemedText style={styles.title} type="defaultSemiBold">
          Payment received
        </ThemedText>
        <ThemedText style={styles.subtitle}>Updating your subscription…</ThemedText>
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
  },
  title: {
    fontSize: 18,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.75,
    textAlign: 'center',
  },
});
