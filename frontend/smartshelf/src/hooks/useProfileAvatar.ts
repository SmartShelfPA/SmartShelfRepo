import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/src/store/auth';
import { getProfileAvatarUri, saveProfileAvatar } from '@/src/lib/profileAvatar';

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function useProfileAvatar() {
  const user = useAuthStore((state) => state.user);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const displayName = user?.full_name || user?.username || 'SmartShelf User';
  const userInitials = initialsFromName(displayName);

  const loadAvatar = useCallback(async () => {
    if (!user?.id) {
      setAvatarUri(null);
      return;
    }
    const localUri = await getProfileAvatarUri(user.id);
    setAvatarUri(localUri ?? user.avatar_url ?? null);
  }, [user?.id, user?.avatar_url]);

  useEffect(() => {
    void loadAvatar();
  }, [loadAvatar]);

  const saveFromPickerUri = useCallback(
    async (sourceUri: string) => {
      if (!user?.id) return;
      const uri = await saveProfileAvatar(user.id, sourceUri);
      setAvatarUri(uri);
    },
    [user?.id]
  );

  return {
    avatarUri,
    userInitials,
    displayName,
    saveFromPickerUri,
    reloadAvatar: loadAvatar,
  };
}
