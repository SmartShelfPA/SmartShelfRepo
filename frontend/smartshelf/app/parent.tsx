import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ParentDashboardData } from '@/src/types/parent';
import { fetchParentDashboard } from '@/src/api/parent';
import { ParentHeader, ParentSummaryCards } from '@/src/components/parent';
import { ChildProgressCard } from '@/src/components/parent/ChildProgressCard';
import { AccountMenu } from '@/src/components/AccountMenu';
import { useRequireRole } from '@/src/hooks/useRequireRole';

export default function ParentView() {
  const allowed = useRequireRole(['parent']);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const tagBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const [dashboard, setDashboard] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setDashboard(await fetchParentDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parent dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed || loading) {
    return (
      <ThemedView style={[styles.container, styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={[styles.loadingText, { color: mutedTextColor }]}>
          Loading dashboard…
        </ThemedText>
      </ThemedView>
    );
  }

  if (error || !dashboard) {
    return (
      <ThemedView style={[styles.container, styles.centered, { backgroundColor }]}>
        <MaterialIcons name="error-outline" size={48} color={mutedTextColor} />
        <ThemedText style={[styles.errorText, { color: textColor }]}>
          {error ?? 'Could not load your dashboard.'}
        </ThemedText>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: tintColor }]}
          onPress={() => load()}
          activeOpacity={0.8}>
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const children = dashboard.children ?? [];

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ParentHeader
        parentName={dashboard.parentName ?? 'Parent'}
        onProfilePress={() => setMenuOpen(true)}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 16, paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
        showsVerticalScrollIndicator={false}>
        <ParentSummaryCards
          totalChildren={dashboard.totalChildren ?? 0}
          totalItemsTracked={dashboard.totalItemsTracked ?? 0}
        />

        {children.length === 0 ? (
          <ThemedView style={[styles.emptyCard, { backgroundColor: cardBgColor, borderColor: tagBgColor }]}>
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
              No linked children yet
            </ThemedText>
            <ThemedText style={[styles.emptyBody, { color: mutedTextColor }]}>
              Your child&apos;s teacher can send you a parent invite code. Each code links your account
              to one child, so ask for a code for each of your children.
            </ThemedText>
          </ThemedView>
        ) : (
          children.map((child) => <ChildProgressCard key={child.id} child={child} />)
        )}

        <TouchableOpacity
          style={[styles.featureCard, { borderColor: tagBgColor, backgroundColor: cardBgColor }]}
          onPress={() => router.push('/feedback')}
          activeOpacity={0.8}>
          <MaterialIcons name="support-agent" size={24} color={tintColor} />
          <View style={styles.featureCardContent}>
            <ThemedText style={[styles.featureCardLabel, { color: textColor }]}>
              Help & feedback
            </ThemedText>
            <ThemedText style={[styles.featureCardDesc, { color: mutedTextColor }]}>
              Tell us what you need to see about your child&apos;s learning, or get help.
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={tintColor} />
        </TouchableOpacity>
      </ScrollView>

      <AccountMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={dashboard.parentName}
        subtitle="Parent account"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  featureCardContent: {
    flex: 1,
    gap: 2,
  },
  featureCardLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureCardDesc: {
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyBody: { fontSize: 14, lineHeight: 20 },
});
