import { Stack } from 'expo-router';

import { RequireAuth } from '@/src/hooks/useRequireRole';

export default function StaffLayout() {
  return (
    <RequireAuth>
      <Stack screenOptions={{ headerShown: false }} />
    </RequireAuth>
  );
}
