import { universalStorage } from '@/src/lib/universalStorage';

function storageKeyForUser(userId: string): string {
  return `@smartshelf:profile_avatar:${userId}`;
}

/**
 * Web/Electron: store avatar as a data URL in universalStorage (no expo-file-system).
 */
export async function saveProfileAvatar(userId: string, sourceUri: string): Promise<string> {
  let dataUrl = sourceUri;
  if (!sourceUri.startsWith('data:')) {
    const response = await fetch(sourceUri);
    const blob = await response.blob();
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read avatar'));
      reader.readAsDataURL(blob);
    });
  }
  await universalStorage.setItem(storageKeyForUser(userId), dataUrl);
  return dataUrl;
}

export async function getProfileAvatarUri(userId: string): Promise<string | null> {
  return universalStorage.getItem(storageKeyForUser(userId));
}
