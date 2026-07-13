import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/src/store/auth';

/** Redirect unauthenticated users to student sign up. */
export function useRequireAuth() {
  const router = useRouter();
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isHydrating && !isAuthenticated) {
      router.replace('/register');
    }
  }, [isHydrating, isAuthenticated, router]);
}
