import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  IgcseEmptyState,
  IgcseErrorState,
  IgcseListSkeleton,
  IgcseStudyResourceCard,
} from '@/src/components/igcse';
import { useIgcsChapterSet, useIgcsScreenTheme } from '@/src/hooks/igcse';
import { openIgcsPdf, openIgcsSimulator, resolveMediaUrl } from '@/src/api/igcseNavigation';

function formatGeneratedAt(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function IgcsChapterDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    subject: string | string[];
    chapter: string | string[];
  }>();
  const subjectRaw = Array.isArray(params.subject) ? params.subject[0] : params.subject;
  const chapterRaw = Array.isArray(params.chapter) ? params.chapter[0] : params.chapter;
  const subject = (subjectRaw ?? '').trim().toLowerCase();
  const chapter = (chapterRaw ?? '').trim().toLowerCase();

  const theme = useIgcsScreenTheme();
  const { data: set, loading, error, refetch, empty } = useIgcsChapterSet(subject, chapter);

  const practiceUrl = resolveMediaUrl(
    set?.practice_paper?.url ?? set?.practice_paper_url ?? ''
  );
  const solutionsUrl = resolveMediaUrl(
    set?.worked_solutions?.url ?? set?.worked_solutions_url ?? ''
  );
  const simulatorUrl = (set?.simulator?.public_url ?? set?.simulator_public_url ?? '').trim();

  const chapterTitle = set?.chapter_title || chapter.replace(/_/g, ' ');

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
          <ThemedText type="title" numberOfLines={2}>
            {chapterTitle}
          </ThemedText>
          <ThemedText style={{ color: theme.mutedTextColor, fontSize: 12 }} numberOfLines={1}>
            {subject} · Study resources
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => void refetch()} style={styles.iconBtn} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={22} color={theme.tintColor} />
        </TouchableOpacity>
      </View>

      {!subject || !chapter ? (
        <View style={styles.center}>
          <ThemedText style={{ color: theme.mutedTextColor }}>Missing route parameters.</ThemedText>
        </View>
      ) : loading ? (
        <IgcseListSkeleton
          message="Loading study set…"
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
      ) : empty || !set ? (
        <IgcseEmptyState
          icon="inventory-2"
          title="No resources published"
          message="There is no published practice set for this chapter yet. Try again later or pick another chapter."
          actionLabel="Refresh"
          onAction={() => void refetch()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.meta, { borderColor: theme.borderColor, backgroundColor: theme.cardBgColor }]}>
            <ThemedText style={{ color: theme.mutedTextColor, fontSize: 12 }}>
              Generated {formatGeneratedAt(set.generated_at)}
              {set.version > 1 ? ` · v${set.version}` : ''}
              {set.quality_score != null
                ? ` · Quality ${Math.round(set.quality_score * 100)}%`
                : ''}
            </ThemedText>
          </View>

          <ThemedText style={[styles.sectionLabel, { color: theme.mutedTextColor }]}>
            Your study pack
          </ThemedText>

          <IgcseStudyResourceCard
            title="Practice paper"
            description="Exam-style paper generated for this chapter. Open in the PDF viewer."
            icon="description"
            disabled={!practiceUrl}
            onPress={() => openIgcsPdf(router, practiceUrl, `${chapterTitle} — Practice`)}
            textColor={theme.textColor}
            mutedColor={theme.mutedTextColor}
            tintColor={theme.tintColor}
            borderColor={theme.borderColor}
            cardBg={theme.cardBgColor}
          />

          <IgcseStudyResourceCard
            title="Worked solutions"
            description="Step-by-step solutions for the practice paper."
            icon="fact-check"
            disabled={!solutionsUrl}
            onPress={() => openIgcsPdf(router, solutionsUrl, `${chapterTitle} — Solutions`)}
            textColor={theme.textColor}
            mutedColor={theme.mutedTextColor}
            tintColor={theme.tintColor}
            borderColor={theme.borderColor}
            cardBg={theme.cardBgColor}
          />

          <IgcseStudyResourceCard
            title="Exam simulator"
            description={
              simulatorUrl
                ? 'Interactive practice in a secure in-app browser.'
                : 'Simulator URL not available for this set.'
            }
            icon="sports-esports"
            disabled={!simulatorUrl}
            onPress={() =>
              openIgcsSimulator(router, {
                url: simulatorUrl,
                title: `${chapterTitle} — Simulator`,
                setId: set.id,
              })
            }
            textColor={theme.textColor}
            mutedColor={theme.mutedTextColor}
            tintColor={theme.tintColor}
            borderColor={theme.borderColor}
            cardBg={theme.cardBgColor}
          />
        </ScrollView>
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
  scroll: { padding: 16, gap: 12 },
  meta: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: 2,
  },
});
