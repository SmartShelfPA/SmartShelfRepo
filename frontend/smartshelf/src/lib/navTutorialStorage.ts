import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@smartshelf:nav_tutorial_seen';

async function readMap(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** True when this account already finished or skipped the sign-in tour on this device. */
export async function hasSeenNavTutorial(userId: string): Promise<boolean> {
  const map = await readMap();
  return map[userId] === true;
}

export async function markNavTutorialSeen(userId: string): Promise<void> {
  try {
    const map = await readMap();
    map[userId] = true;
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // If saving fails, the tour can appear again on the next sign-in.
  }
}
