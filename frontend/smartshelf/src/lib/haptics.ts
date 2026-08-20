import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

/** Safe haptics — no-ops on web/Electron where the native module is unavailable. */
export async function impactAsync(
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Light
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ExpoHaptics.impactAsync(style);
  } catch {
    // ignore
  }
}

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
