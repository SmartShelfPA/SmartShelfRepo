import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/src/store/auth';

/** Redirect unauthenticated users to the onboarding entry (account select). */
export function useRequireAuth() {
  const router = useRouter();
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isHydrating && !isAuthenticated) {
      router.replace('/account-select');
    }
  }, [isHydrating, isAuthenticated, router]);
}
