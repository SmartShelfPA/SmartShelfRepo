import { createElement, Fragment, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'expo-router';

import type { UserRole } from '@/services/api';
import { rememberReturnTo } from '@/src/lib/returnTo';
import { useAuthStore } from '@/src/store/auth';

function useRedirectSignedOut() {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isHydrating || isAuthenticated) return;
    rememberReturnTo(pathname);
    router.replace('/register');
  }, [isHydrating, isAuthenticated, pathname, router]);

  return !isHydrating && isAuthenticated;
}

/** Signed-out visitors are sent to sign up, then brought back to this screen. */
export function useRequireAuth(): boolean {
  return useRedirectSignedOut();
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const ready = useRequireAuth();
  if (!ready) return null;
  return createElement(Fragment, null, children);
}

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
  const signedIn = useRedirectSignedOut();

  const allowed = signedIn && !!role && roles.includes(role);

  useEffect(() => {
    if (isHydrating || !isAuthenticated) return;
    if (!role) return;
    if (!key.split(',').includes(role)) {
      router.replace(getHomeRoute());
    }
  }, [isHydrating, isAuthenticated, role, key, router, getHomeRoute]);

  return allowed;
}
