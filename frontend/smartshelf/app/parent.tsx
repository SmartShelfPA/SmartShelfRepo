import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ParentDashboardData } from '@/src/types/parent';
import { fetchParentDashboard } from '@/src/api/parent';
import { ParentHeader, ParentSummaryCards } from '@/src/components/parent';

export default function ParentView() {
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
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchParentDashboard()
      .then((data) => {
        if (!cancelled) {
          setDashboard(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load parent dashboard');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetchParentDashboard()
      .then((data) => {
        if (mountedRef.current) setDashboard(data);
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load parent dashboard');
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={[styles.loadingText, { color: mutedTextColor }]}>
          Loading dashboard…
        </ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={[styles.container, styles.centered, { backgroundColor }]}>
        <MaterialIcons name="error-outline" size={48} color={mutedTextColor} />
        <ThemedText style={[styles.errorText, { color: textColor }]}>{error}</ThemedText>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: tintColor }]}
          onPress={handleRetry}
          activeOpacity={0.8}>
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ParentHeader
        parentName={dashboard.parentName ?? 'Parent'}
        onBackPress={() => router.replace('/account-select')}
        onProfilePress={() => router.replace('/account-select')}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 16,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <ParentSummaryCards
          totalChildren={dashboard.totalChildren ?? 0}
          totalItemsTracked={dashboard.totalItemsTracked ?? 0}
        />

        {/* Student features: Exam boards & Sample papers */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: mutedTextColor }]}>
            EXAM BOARDS
          </ThemedText>
          <View style={styles.examBoardRow}>
            {[
              { label: 'IGCSE', icon: 'school' },
              { label: 'WAEC', icon: 'menu-book' },
              { label: 'JAMB', icon: 'edit-note' },
            ].map((board) => (
              <TouchableOpacity
                key={board.label}
                style={[styles.examBoardIcon, { borderColor: tintColor, backgroundColor: cardBgColor }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/(tabs)/bookshelf',
                    params: { board: board.label, section: 'Textbooks' },
                  });
                }}
                activeOpacity={0.8}>
                <MaterialIcons name={board.icon as any} size={24} color={tintColor} />
                <ThemedText style={styles.examBoardLabel}>{board.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Link href="/sample-papers" asChild>
          <TouchableOpacity
            style={[styles.featureCard, { borderColor: tagBgColor, backgroundColor: cardBgColor }]}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            activeOpacity={0.8}>
            <MaterialIcons name="picture-as-pdf" size={24} color={tintColor} />
            <ThemedText style={[styles.featureCardLabel, { color: textColor }]}>
              Sample Papers
            </ThemedText>
            <MaterialIcons name="chevron-right" size={20} color={tintColor} />
          </TouchableOpacity>
        </Link>

        {/* Progress Tracking */}
        <TouchableOpacity
          style={[styles.featureCard, { borderColor: tagBgColor, backgroundColor: cardBgColor }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          activeOpacity={0.8}>
          <MaterialIcons name="trending-up" size={24} color={tintColor} />
          <View style={styles.featureCardContent}>
            <ThemedText style={[styles.featureCardLabel, { color: textColor }]}>
              Progress Tracking
            </ThemedText>
            <ThemedText style={[styles.featureCardDesc, { color: mutedTextColor }]}>
              Homework, reading time, quiz scores, study streaks
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={tintColor} />
        </TouchableOpacity>

        {/* Activity Reports */}
        <TouchableOpacity
          style={[styles.featureCard, { borderColor: tagBgColor, backgroundColor: cardBgColor }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          activeOpacity={0.8}>
          <MaterialIcons name="notifications-active" size={24} color={tintColor} />
          <View style={styles.featureCardContent}>
            <ThemedText style={[styles.featureCardLabel, { color: textColor }]}>
              Activity Reports
            </ThemedText>
            <ThemedText style={[styles.featureCardDesc, { color: mutedTextColor }]}>
              Textbooks opened, pages read, daily/weekly study hours
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={tintColor} />
        </TouchableOpacity>

        {/* Performance Insights */}
        <TouchableOpacity
          style={[styles.featureCard, { borderColor: tagBgColor, backgroundColor: cardBgColor }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          activeOpacity={0.8}>
          <MaterialIcons name="lightbulb" size={24} color={tintColor} />
          <View style={styles.featureCardContent}>
            <ThemedText style={[styles.featureCardLabel, { color: textColor }]}>
              Performance Insights
            </ThemedText>
            <ThemedText style={[styles.featureCardDesc, { color: mutedTextColor }]}>
              Alerts for low engagement, tips to encourage study
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={tintColor} />
        </TouchableOpacity>

        {/* Child Account Management */}
        <TouchableOpacity
          style={[styles.featureCard, { borderColor: tagBgColor, backgroundColor: cardBgColor }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          activeOpacity={0.8}>
          <MaterialIcons name="family-restroom" size={24} color={tintColor} />
          <View style={styles.featureCardContent}>
            <ThemedText style={[styles.featureCardLabel, { color: textColor }]}>
              Child Account Management
            </ThemedText>
            <ThemedText style={[styles.featureCardDesc, { color: mutedTextColor }]}>
              Approve downloads, link kids, set screen time limits
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={tintColor} />
        </TouchableOpacity>

        {/* School Updates */}
        <TouchableOpacity
          style={[styles.featureCard, { borderColor: tagBgColor, backgroundColor: cardBgColor }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          activeOpacity={0.8}>
          <MaterialIcons name="campaign" size={24} color={tintColor} />
          <View style={styles.featureCardContent}>
            <ThemedText style={[styles.featureCardLabel, { color: textColor }]}>
              School & Publisher Updates
            </ThemedText>
            <ThemedText style={[styles.featureCardDesc, { color: mutedTextColor }]}>
              Announcements, curriculum changes, message teachers
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={tintColor} />
        </TouchableOpacity>
      </ScrollView>
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
  section: {
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  examBoardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  examBoardIcon: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  examBoardLabel: {
    fontSize: 12,
    fontWeight: '600',
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
});
