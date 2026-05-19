import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  IgcseEmptyState,
  IgcseErrorState,
  IgcseListSkeleton,
  IgcseSubjectCard,
} from '@/src/components/igcse';
import { useIgcsScreenTheme, useIGCSESubjects } from '@/src/hooks/igcse';

export default function IgcsSubjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();
  const { data: subjects, loading, error, refetch, empty } = useIGCSESubjects();

  return (
    <ThemedView style={[styles.wrap, { backgroundColor: theme.backgroundColor }]}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 16), borderBottomColor: theme.borderColor },
        ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={24} color={theme.tintColor} />
        </TouchableOpacity>
        <ThemedText type="title">Study resources</ThemedText>
        <TouchableOpacity onPress={() => void refetch()} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={22} color={theme.tintColor} />
        </TouchableOpacity>
      </View>
      <ThemedText style={[styles.sub, { color: theme.mutedTextColor }]}>
        Practice papers, worked solutions, and exam simulators from your SmartShelf catalog.
      </ThemedText>

      {loading ? (
        <IgcseListSkeleton
          message="Loading subjects…"
          tintColor={theme.tintColor}
          mutedColor={theme.mutedTextColor}
        />
      ) : error ? (
        <IgcseErrorState
          message={error}
          onRetry={() => void refetch()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : empty ? (
        <IgcseEmptyState
          icon="school"
          title="No subjects yet"
          message="Ask your admin to ingest IGCSE content from the study-agent pipeline."
          actionLabel="Refresh"
          onAction={() => void refetch()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          renderItem={({ item }) => (
            <IgcseSubjectCard
              subject={item}
              onPress={() =>
                router.push({
                  pathname: '/igcse/revision/[subject]',
                  params: { subject: item.id },
                } as Href)
              }
              textColor={theme.textColor}
              mutedColor={theme.mutedTextColor}
              tintColor={theme.tintColor}
              borderColor={theme.borderColor}
              cardBg={theme.cardBgColor}
            />
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 6 },
  sub: { paddingHorizontal: 16, marginTop: 8, marginBottom: 4, fontSize: 14, lineHeight: 20 },
});
