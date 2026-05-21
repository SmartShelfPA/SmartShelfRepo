import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthStore } from '@/src/store/auth';

type Props = {
  children: React.ReactNode;
};

/**
 * Restores persisted session on cold start and validates the token with the backend.
 */
export function AuthBootstrap({ children }: Props) {
  const initialize = useAuthStore((s) => s.initialize);
  const isHydrating = useAuthStore((s) => s.isHydrating);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (isHydrating) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#00FF41" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});
