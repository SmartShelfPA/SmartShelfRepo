import { useEffect } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { IgcseListSkeleton } from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';

/** Legacy MCQ session — redirects to study resources catalog. */
export default function IgcsRevisionSessionRedirect() {
  const router = useRouter();
  const theme = useIgcsScreenTheme();

  useEffect(() => {
    router.replace('/igcse/revision' as Href);
  }, [router]);

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
      <IgcseListSkeleton
        message="Opening study resources…"
        tintColor={theme.tintColor}
        mutedColor={theme.mutedTextColor}
      />
    </ThemedView>
  );
}
