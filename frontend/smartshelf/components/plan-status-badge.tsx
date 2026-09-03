import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getSubscriptionPlanLabel } from '@/src/lib/subscriptionLabel';

type Props = {
  planId?: string | null;
  tier?: string | null;
  hasActive?: boolean;
};

/**
 * Quiet home-screen plan chip — readable at a glance, not a banner.
 * Taps through to Profile so users can manage Prices.
 */
export function PlanStatusBadge({ planId, tier, hasActive }: Props) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const isDark = colorScheme === 'dark';

  const activeLabel = getSubscriptionPlanLabel({ planId, tier, hasActive });
  const label = activeLabel ?? 'Free plan';
  const isActive = Boolean(activeLabel);

  const borderColor = isActive
    ? isDark
      ? 'rgba(0, 255, 65, 0.35)'
      : 'rgba(0, 180, 50, 0.35)'
    : isDark
      ? '#2A2A2A'
      : '#E5E5E5';
  const bgColor = isActive
    ? isDark
      ? 'rgba(0, 255, 65, 0.08)'
      : 'rgba(0, 180, 50, 0.06)'
    : isDark
      ? '#1A1A1A'
      : '#F5F5F5';
  const iconColor = isActive ? '#00FF41' : isDark ? '#9BA1A6' : '#687076';
  const labelColor = isActive ? textColor : isDark ? '#9BA1A6' : '#687076';

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.chip, { borderColor, backgroundColor: bgColor }]}
        onPress={() => router.push('/(tabs)/profile')}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={isActive ? `Current plan: ${label}` : 'Free plan. Open prices'}>
        <MaterialIcons
          name={isActive ? 'verified' : 'workspace-premium'}
          size={14}
          color={iconColor}
        />
        <ThemedText style={[styles.label, { color: labelColor }]}>{label}</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
