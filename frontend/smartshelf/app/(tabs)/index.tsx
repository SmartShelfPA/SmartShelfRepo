import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedView } from '@/components/themed-view';
import { HomeHeader } from '@/components/home-header';
import { StreakBadge } from '@/components/streak-badge';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/src/store/auth';
import { fetchQuote, Quote } from '@/services/quotes';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const colorScheme = useColorScheme();
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green
  const oliveBorder = '#00FF41'; // Match SmartShelf logo green
  const firstName = user?.full_name?.split(' ')[0] || 'Reader';
  const greetingText = `Hi, ${firstName}`;
  const [typedGreeting, setTypedGreeting] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const [typingDone, setTypingDone] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

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
      <HomeHeader userInitials="AS" rightContent={<StreakBadge streakDays={7} />} />
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
              EXAM BOARDS
            </ThemedText>
            <ThemedView style={styles.examBoardRow}>
              {[
                { label: 'IGCSE', icon: 'school' },
                { label: 'WAEC', icon: 'menu-book' },
                { label: 'JAMB', icon: 'edit-note' },
              ].map((board) => (
                <TouchableOpacity
                  key={board.label}
                  style={[styles.examBoardIcon, { borderColor: oliveBorder, backgroundColor: cardBgColor }]}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/bookshelf',
                      params: { board: board.label, section: 'Textbooks' },
                    })
                  }
                  activeOpacity={0.8}>
                  <MaterialIcons name={board.icon as any} size={24} color={tintColor} />
                  <ThemedText style={styles.examBoardLabel}>{board.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>

          <TouchableOpacity
            style={[styles.samplePapersCard, { borderColor: oliveBorder, backgroundColor: cardBgColor }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/sample-papers');
            }}
            activeOpacity={0.8}>
            <MaterialIcons name="picture-as-pdf" size={24} color={tintColor} />
            <ThemedText style={styles.samplePapersLabel}>Sample Papers</ThemedText>
            <MaterialIcons name="chevron-right" size={20} color={tintColor} />
          </TouchableOpacity>

          {quote && (
            <ThemedView style={styles.quoteCard}>
              <ThemedText style={styles.quoteText}>"{quote.text}"</ThemedText>
              <ThemedText style={styles.quoteAuthor}>— {quote.author}</ThemedText>
            </ThemedView>
          )}
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
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    lineHeight: 36,
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
  samplePapersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  samplePapersLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
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
