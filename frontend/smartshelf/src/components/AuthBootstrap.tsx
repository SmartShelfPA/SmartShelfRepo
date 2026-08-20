import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { useAuthStore } from '@/src/store/auth';

type Props = {
  children: React.ReactNode;
};

/**
 * Restores persisted session on cold start and validates the token with the backend.
 * Web: waits for client mount so SSR HTML does not stay on the splash forever.
 */
export function AuthBootstrap({ children }: Props) {
  const initialize = useAuthStore((s) => s.initialize);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const [isClient, setIsClient] = useState(Platform.OS !== 'web');

  useEffect(() => {
    setIsClient(true);
    void initialize();
  }, [initialize]);

  if (!isClient || isHydrating) {
    return (
      <View style={styles.splash} accessibilityLabel="SmartShelf is loading">
        <Image
          source={require('@/assets/images/ss-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
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
  logo: {
    width: 180,
    height: 180,
  },
});
