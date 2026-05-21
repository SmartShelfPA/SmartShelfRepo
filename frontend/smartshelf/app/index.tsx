import { Redirect } from 'expo-router';

import { useAuthStore } from '@/src/store/auth';

/**
 * App entry: signed-in users → home; everyone else → who's using SmartShelf.
 */
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const getHomeRoute = useAuthStore((s) => s.getHomeRoute);

  if (isAuthenticated) {
    return <Redirect href={getHomeRoute()} />;
  }

  return <Redirect href="/account-select" />;
}
