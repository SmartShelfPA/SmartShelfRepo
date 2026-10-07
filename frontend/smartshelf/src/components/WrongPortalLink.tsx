import { TouchableOpacity } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';

const TARGETS: Record<string, { label: string; href: Href }> = {
  student: { label: 'Go to student sign in', href: '/login' },
  parent: { label: 'Go to parent sign in', href: '/parent-sign-in' },
  staff: { label: 'Go to teacher sign in', href: '/teacher-sign-in' },
};

/** Shown after a `wrong_portal` login error: sends the user to the sign-in screen for their role. */
export function WrongPortalLink({ role }: { role: string | null }) {
  const router = useRouter();
  const target = role ? TARGETS[role] : undefined;
  if (!target) return null;
  return (
    <TouchableOpacity onPress={() => router.replace(target.href)} accessibilityRole="link" style={{ paddingVertical: 8 }}>
      <ThemedText style={{ color: '#00C832', fontWeight: '700', textAlign: 'center' }}>{target.label} →</ThemedText>
    </TouchableOpacity>
  );
}

export function wrongPortalRole(e: unknown): string | null {
  const err = e as { code?: string; role?: string | null } | null;
  return err?.code === 'wrong_portal' ? (err.role ?? null) : null;
}
