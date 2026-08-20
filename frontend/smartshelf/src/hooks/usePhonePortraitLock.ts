import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Prefer portrait on phones only. Large screens (>= 600dp short side) stay unlocked
 * so Android 16+ tablet/foldable guidance is satisfied.
 */
export function usePhonePortraitLock() {
  const { width, height } = useWindowDimensions();
  const isLargeScreen = Math.min(width, height) >= 600;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;

    async function apply() {
      try {
        if (!active) return;
        if (isLargeScreen) {
          await ScreenOrientation.unlockAsync();
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {
        // Orientation APIs can fail on some emulators; ignore.
      }
    }

    void apply();

    return () => {
      active = false;
    };
  }, [isLargeScreen]);
}
