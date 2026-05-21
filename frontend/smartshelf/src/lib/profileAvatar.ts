import { Directory, File, Paths } from 'expo-file-system';

import { universalStorage } from '@/src/lib/universalStorage';

function avatarDirectory(): Directory {
  return new Directory(Paths.document, 'profile-avatars');
}

function avatarFileForUser(userId: string): File {
  return new File(avatarDirectory(), `${userId}.jpg`);
}

function storageKeyForUser(userId: string): string {
  return `@smartshelf:profile_avatar:${userId}`;
}

/** Copy picked image into app storage and remember its path for this user. */
export async function saveProfileAvatar(userId: string, sourceUri: string): Promise<string> {
  const dir = avatarDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const dest = avatarFileForUser(userId);
  const source = new File(sourceUri);

  if (dest.exists) {
    dest.delete();
  }

  source.copy(dest);
  await universalStorage.setItem(storageKeyForUser(userId), dest.uri);
  return dest.uri;
}

/** Load saved avatar file URI for a user, or null if none exists. */
export async function getProfileAvatarUri(userId: string): Promise<string | null> {
  const stored = await universalStorage.getItem(storageKeyForUser(userId));
  const defaultUri = avatarFileForUser(userId).uri;
  const candidates = [stored, defaultUri].filter(Boolean) as string[];

  for (const uri of candidates) {
    const file = new File(uri);
    if (file.exists) {
      return uri;
    }
  }

  return null;
}
