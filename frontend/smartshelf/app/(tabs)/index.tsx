import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedView } from '@/components/themed-view';
import { HomeHeader } from '@/components/home-header';
import { StreakBadge } from '@/components/streak-badge';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/src/store/auth';
import { useProfileAvatar } from '@/src/hooks/useProfileAvatar';
import { fetchQuote, Quote } from '@/services/quotes';
import { DashboardSection } from '@/src/components/dashboard/DashboardSection';
import { useDashboardData } from '@/src/hooks/useDashboardData';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { avatarUri, userInitials } = useProfileAvatar();
  const colorScheme = useColorScheme();
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green
  const oliveBorder = '#00FF41'; // Match SmartShelf logo green
  const displayName = user?.username?.trim() || user?.full_name?.split(' ')[0] || 'Reader';
  const greetingText = `Hi, ${displayName}`;
  const [typedGreeting, setTypedGreeting] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const [typingDone, setTypingDone] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const { data: dashboard, isLoading: dashLoading, error: dashError, refetch: refetchDash } =
    useDashboardData();

  useEffect(() => {
    let isMounted = true;
    fetchQuote()
      .then((nextQuote) => {
        if (isMounted) {
          setQuote(nextQuote);
        }
      })
      .catch(() => {
        if (isMounted) {
          setQuote(null);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let index = 0;
    setTypedGreeting('');
    setCursorVisible(true);
    setTypingDone(false);
    const timer = setInterval(() => {
      index += 1;
      setTypedGreeting(greetingText.slice(0, index));
      if (index >= greetingText.length) {
        clearInterval(timer);
        setTypingDone(true);
        setCursorVisible(false);
      }
    }, 140);
    return () => clearInterval(timer);
  }, [greetingText]);

  useEffect(() => {
    if (typingDone) {
      return;
    }
    const blinkTimer = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(blinkTimer);
  }, [typingDone]);

  return (
    <ThemedView style={styles.container}>
      <HomeHeader
        userInitials={userInitials}
        avatarUri={avatarUri ?? undefined}
        rightContent={<StreakBadge streakDays={7} />}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.content}>
          <ThemedText style={styles.greetingText} type="defaultSemiBold">
            {typedGreeting || ' '}
            <ThemedText style={styles.cursorText}>
              {cursorVisible ? '|' : ' '}
            </ThemedText>
          </ThemedText>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              TEXTBOOKS
            </ThemedText>
            <ThemedView style={styles.examBoardRow}>
              {[{ label: 'IGCSE shelf', subtitle: 'Coming soon', icon: 'auto-stories' }].map((board) => (
                <TouchableOpacity
                  key={board.label}
                  style={[styles.examBoardIcon, { borderColor: oliveBorder, backgroundColor: cardBgColor }]}
                  onPress={() => {
                    router.push('/igcse-coming-soon' as Href);
                  }}
                  activeOpacity={0.8}>
                  <MaterialIcons name={board.icon as any} size={24} color={tintColor} />
                  <ThemedText style={styles.examBoardLabel}>{board.label}</ThemedText>
                  {'subtitle' in board && board.subtitle ? (
                    <ThemedText style={styles.examBoardSubtitle}>{board.subtitle}</ThemedText>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              PRACTICE
            </ThemedText>
            <ThemedView style={styles.examBoardRow}>
              {[
                { label: 'WAEC', icon: 'edit-note' },
                { label: 'JAMB', icon: 'edit-note' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.examBoardIcon, { borderColor: oliveBorder, backgroundColor: cardBgColor }]}
                  onPress={() => {
                    router.push((item.label === 'WAEC' ? '/practice/waec' : '/practice/jamb') as Href);
                  }}
                  activeOpacity={0.8}>
                  <MaterialIcons name={item.icon as any} size={24} color={tintColor} />
                  <ThemedText style={styles.examBoardLabel}>{item.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>

          {quote && (
            <ThemedView style={styles.quoteCard}>
              <ThemedText style={styles.quoteText}>
                {'\u201c'}
                {quote.text}
                {'\u201d'}
              </ThemedText>
              <ThemedText style={styles.quoteAuthor}>— {quote.author}</ThemedText>
            </ThemedView>
          )}

          <DashboardSection
            data={dashboard}
            isLoading={dashLoading}
            error={dashError}
            onRetry={() => void refetchDash()}
          />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  content: {
    paddingHorizontal: 16,
    gap: 0,
  },
  greetingText: {
    fontSize: 32,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 36,
    textAlign: 'center',
    width: '100%',
    includeFontPadding: false,
  },
  cursorText: {
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 36,
    includeFontPadding: false,
  },
  section: {
    marginTop: 4,
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  examBoardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
  examBoardSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.75,
  },
  quoteCard: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#00000008',
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  quoteAuthor: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
  },
});
