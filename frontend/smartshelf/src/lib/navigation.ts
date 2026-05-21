import type { Href } from 'expo-router';

import type { UserRole } from '@/services/api';
import type { PortalChoice } from '@/src/lib/portalChoice';

/** Home route after sign-in: parent portal vs student tabs. */
export function getHomeHref(params: {
  portal?: PortalChoice | null;
  role?: UserRole | null;
}): Href {
  if (params.role === 'parent' || params.portal === 'parent') {
    return '/parent';
  }
  return '/(tabs)';
}
