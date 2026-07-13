import type { Href } from 'expo-router';

import type { UserRole } from '@/services/api';
import type { PortalChoice } from '@/src/lib/portalChoice';

/** Home route after sign-in: role-based dashboard routing. */
export function getHomeHref(params: {
  portal?: PortalChoice | null;
  role?: UserRole | null;
}): Href {
  if (params.role === 'staff') {
    return '/teacher';
  }
  if (params.role === 'parent') {
    return '/parent';
  }
  return '/(tabs)';
}
