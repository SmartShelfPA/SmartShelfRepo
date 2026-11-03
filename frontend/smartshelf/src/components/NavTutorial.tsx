import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { usePathname, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isAuthPath, isAuthSegments, isReaderPath, isReaderSegments, useIsDesktopLayout } from '@/src/lib/desktop';
import { hasSeenNavTutorial, markNavTutorialSeen } from '@/src/lib/navTutorialStorage';
import { navTutorialSteps } from '@/src/lib/navTutorialSteps';
import { useAuthStore } from '@/src/store/auth';

/**
 * Short navigation tour. Opens after a fresh sign-in (not when a saved session
 * is restored) until the account finishes or skips it on this device.
 */
export function NavTutorial() {
  const request = useAuthStore((s) => s.navTutorialRequest);
  const closeNavTutorial = useAuthStore((s) => s.closeNavTutorial);
  const user = useAuthStore((s) => s.user);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const desktop = useIsDesktopLayout();
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const blocked =
    isHydrating ||
    isAuthSegments(segments) ||
    isAuthPath(pathname) ||
    isReaderSegments(segments) ||
    isReaderPath(pathname);

  const steps = useMemo(
    () =>
      navTutorialSteps({
        role: user?.role,
        desktop,
        hasSchool: Boolean(user?.role === 'student' && user.organization),
        isSchoolAdmin: Boolean(user?.is_school_admin),
      }),
    [desktop, user?.is_school_admin, user?.organization, user?.role]
  );

  useEffect(() => {
    if (request === 'off' || !user?.id || blocked) {
      setOpen(false);
      return;
    }

    let cancelled = false;
    const userId = user.id;

    if (request === 'replay') {
      setStepIndex(0);
      setOpen(true);
      return;
    }

    void hasSeenNavTutorial(userId).then((seen) => {
      if (cancelled) return;
      if (seen) {
        closeNavTutorial();
        setOpen(false);
        return;
      }
      setStepIndex(0);
      setOpen(true);
    });

    return () => {
      cancelled = true;
    };
  }, [blocked, closeNavTutorial, request, user?.id]);

  const finish = async (remember: boolean) => {
    setOpen(false);
    closeNavTutorial();
    if (remember && user?.id) {
      await markNavTutorialSeen(user.id);
    }
  };

  if (!open || steps.length === 0) return null;

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const last = stepIndex >= steps.length - 1;
  const cardBg = isDark ? '#1F1F1F' : '#FFFFFF';
  const muted = isDark ? '#9BA1A6' : '#687076';
  const border = isDark ? '#2A2A2A' : '#E5E5E5';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void finish(true)}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              marginBottom: Math.max(insets.bottom, 16),
              marginTop: Math.max(insets.top, 16),
            },
          ]}
          accessibilityViewIsModal>
          <View style={styles.topRow}>
            <ThemedText style={[styles.progress, { color: muted }]}>
              Step {stepIndex + 1} of {steps.length}
            </ThemedText>
            <TouchableOpacity
              onPress={() => void finish(true)}
              accessibilityRole="button"
              accessibilityLabel="Skip tour"
              hitSlop={8}>
              <ThemedText style={[styles.skip, { color: muted }]}>Skip</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.dots} accessibilityElementsHidden>
            {steps.map((item, index) => (
              <View
                key={item.title}
                style={[styles.dot, { backgroundColor: index === stepIndex ? '#00FF41' : border }]}
              />
            ))}
          </View>

          <View style={styles.iconWrap}>
            <MaterialIcons name={step.icon} size={28} color="#111" />
          </View>

          <ThemedText style={styles.title}>{step.title}</ThemedText>
          <ThemedText style={[styles.body, { color: muted }]}>{step.body}</ThemedText>

          <View style={[styles.where, { borderColor: border }]}>
            <MaterialIcons name="near-me" size={16} color="#00C832" />
            <ThemedText style={styles.whereText}>{step.where}</ThemedText>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.secondary, { borderColor: border, opacity: stepIndex === 0 ? 0.4 : 1 }]}
              onPress={() => setStepIndex((index) => Math.max(0, index - 1))}
              disabled={stepIndex === 0}
              accessibilityRole="button"
              accessibilityLabel="Previous step">
              <ThemedText style={styles.secondaryText}>Back</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => {
                if (last) void finish(true);
                else setStepIndex((index) => index + 1);
              }}
              accessibilityRole="button"
              accessibilityLabel={last ? 'Finish tour' : 'Next step'}>
              <ThemedText style={styles.primaryText}>{last ? 'Done' : 'Next'}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progress: { fontSize: 13, fontWeight: '600' },
  skip: { fontSize: 15, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 4, flex: 1, borderRadius: 2 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#00FF41',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23 },
  where: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  whereText: { flex: 1, fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryText: { fontSize: 16, fontWeight: '700' },
  primary: {
    flex: 1.4,
    borderRadius: 12,
    backgroundColor: '#00FF41',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#111' },
});
