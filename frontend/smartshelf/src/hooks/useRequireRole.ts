import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import type { UserRole } from '@/services/api';
import { useAuthStore } from '@/src/store/auth';

/**
 * Keep a screen to the given roles. Signed-out users go to sign up; signed-in
 * users with another role are sent to their own home screen.
 *
 * Returns true only once the signed-in user is confirmed to have an allowed role,
 * so screens can avoid fetching or rendering anything before then.
 */
export function useRequireRole(roles: UserRole[]): boolean {
  const router = useRouter();
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);
  const getHomeRoute = useAuthStore((s) => s.getHomeRoute);
  const key = roles.join(',');

  const allowed = !isHydrating && isAuthenticated && !!role && roles.includes(role);

  useEffect(() => {
    if (isHydrating) return;
    if (!isAuthenticated) {
      router.replace('/register');
      return;
    }
    if (!role) return;
    if (!key.split(',').includes(role)) {
      router.replace(getHomeRoute());
    }
  }, [isHydrating, isAuthenticated, role, key, router, getHomeRoute]);

  return allowed;
}
