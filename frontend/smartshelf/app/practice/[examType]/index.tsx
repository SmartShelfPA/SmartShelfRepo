import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { fetchPracticeSubjects, fetchPracticeYears, type PracticeSubjectOption } from '@/src/api/practice';
import { parsePracticeExamType } from '@/src/types/exam';
import type { PracticeExamType } from '@/src/types/exam';

export default function PracticeShelfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ examType: string | string[] }>();
  const raw = Array.isArray(params.examType) ? params.examType[0] : params.examType;
  const examType = parsePracticeExamType(raw?.toUpperCase());

  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const [subjects, setSubjects] = useState<PracticeSubjectOption[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectQuery, setSubjectQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<PracticeSubjectOption | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const load = useCallback(async (et: PracticeExamType) => {
    setLoading(true);
    setError(null);
    setSelectedSubject(null);
    try {
      const [s, y] = await Promise.all([fetchPracticeSubjects(et), fetchPracticeYears(et)]);
      setSubjects(s);
      setYears(y);
      setSelectedYear(y[0] ?? new Date().getFullYear());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!examType) return;
    void load(examType);
  }, [examType, load]);

  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) => s.label.toLowerCase().includes(q) || s.alocSlug.toLowerCase().includes(q)
    );
  }, [subjectQuery, subjects]);

  const title =
    examType === 'WAEC'
      ? 'WAEC shelf'
      : examType === 'JAMB'
        ? 'JAMB shelf'
        : examType === 'IGCSE'
          ? 'IGCSE (use IGCSE bookshelf)'
          : 'Practice';

  if (!examType) {
    return (
      <ThemedView style={[styles.wrap, { backgroundColor, paddingTop: insets.top }]}>
        <ThemedText style={{ color: mutedTextColor }}>Unknown exam type</ThemedText>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
          <ThemedText style={{ color: tintColor, fontWeight: '700' }}>Back home</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.wrap, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={{ flex: 1 }}>
          {title}
        </ThemedText>
        <TouchableOpacity onPress={() => void load(examType)} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={22} color={tintColor} />
        </TouchableOpacity>
      </View>

      <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
        Pick a subject and year, then start a practice session.
      </ThemedText>

      <View style={[styles.search, { backgroundColor: cardBgColor, borderColor }]}>
        <MaterialIcons name="search" size={20} color={mutedTextColor} />
        <ThemedTextInput
          style={styles.searchInput}
          placeholder="Filter subjects…"
          placeholderTextColor={mutedTextColor}
          value={subjectQuery}
          onChangeText={setSubjectQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tintColor} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={{ color: mutedTextColor }}>{error}</ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 14 }}
          showsVerticalScrollIndicator={false}>
          <ThemedText style={[styles.sectionLabel, { color: mutedTextColor }]}>Year</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
            {years.map((y) => {
              const active = selectedYear === y;
              return (
                <TouchableOpacity
                  key={y}
                  style={[
                    styles.yearChip,
                    { borderColor: active ? tintColor : borderColor, backgroundColor: cardBgColor },
                  ]}
                  onPress={() => setSelectedYear(y)}
                  activeOpacity={0.85}>
                  <ThemedText style={{ color: active ? tintColor : textColor, fontWeight: '800' }}>{y}</ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ThemedText style={[styles.sectionLabel, { color: mutedTextColor }]}>Subjects</ThemedText>
          <View style={styles.subjectGrid}>
            {filteredSubjects.map((s) => {
              const active = selectedSubject?.alocSlug === s.alocSlug;
              return (
                <TouchableOpacity
                  key={s.alocSlug}
                  style={[
                    styles.subjectCard,
                    { borderColor: active ? tintColor : borderColor, backgroundColor: cardBgColor },
                  ]}
                  onPress={() => setSelectedSubject(s)}
                  activeOpacity={0.85}>
                  <MaterialIcons name="topic" size={22} color={tintColor} />
                  <ThemedText style={[styles.subjectLabel, { color: textColor }]} numberOfLines={2}>
                    {s.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: tintColor }]}
            disabled={!selectedSubject || selectedYear == null}
            onPress={() => {
              if (!selectedSubject || selectedYear == null || !examType) return;
              router.push({
                pathname: '/practice/[examType]/session',
                params: {
                  examType: examType.toLowerCase(),
                  subject: selectedSubject.alocSlug,
                  subjectLabel: selectedSubject.label,
                  year: String(selectedYear),
                },
              });
            }}
            activeOpacity={0.9}>
            <MaterialIcons name="play-arrow" size={22} color="#000" />
            <ThemedText style={styles.startText}>Start practice session</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 6 },
  subtitle: { marginTop: 8, marginBottom: 12, fontSize: 14 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, padding: 0, minHeight: 0, borderWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  yearRow: { gap: 10, paddingVertical: 4 },
  yearChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  subjectCard: {
    width: '47%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    minHeight: 92,
  },
  subjectLabel: { fontSize: 14, fontWeight: '700' },
  startBtn: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 1,
  },
  startText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
