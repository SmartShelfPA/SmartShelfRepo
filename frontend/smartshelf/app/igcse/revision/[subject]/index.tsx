import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  IgcseChapterCard,
  IgcseEmptyState,
  IgcseErrorState,
  IgcseListSkeleton,
} from '@/src/components/igcse';
import { useIgcsChapters, useIgcsScreenTheme } from '@/src/hooks/igcse';

export default function IgcsChaptersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ subject: string | string[] }>();
  const subjectRaw = Array.isArray(params.subject) ? params.subject[0] : params.subject;
  const subject = (subjectRaw ?? '').trim().toLowerCase();

  const theme = useIgcsScreenTheme();
  const { data: chapters, loading, error, refetch, empty } = useIgcsChapters(subject);

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
        <View style={{ flex: 1 }}>
          <ThemedText type="title" numberOfLines={1}>
            Chapters
          </ThemedText>
          <ThemedText style={{ color: theme.mutedTextColor, fontSize: 12 }} numberOfLines={1}>
            {subject || '—'}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => void refetch()} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={22} color={theme.tintColor} />
        </TouchableOpacity>
      </View>

      {!subject ? (
        <View style={styles.center}>
          <ThemedText style={{ color: theme.mutedTextColor }}>Missing subject.</ThemedText>
        </View>
      ) : loading ? (
        <IgcseListSkeleton
          message="Loading chapters…"
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
          icon="menu-book"
          title="No chapters yet"
          message="This subject has no published study sets. Ask your admin to ingest content from the study agent."
          actionLabel="Refresh"
          onAction={() => void refetch()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          renderItem={({ item }) => (
            <IgcseChapterCard
              chapter={item}
              onPress={() =>
                router.push({
                  pathname: '/igcse/revision/[subject]/[chapter]',
                  params: { subject, chapter: item.id },
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
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
