import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import type { Href } from 'expo-router';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IgcseEmptyState } from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';
import {
  getAllDownloads,
  isOfflineExpired,
  removeDownload,
  type ProtectedDownloadRecord,
} from '@/src/lib/secureDownloadStore';
import { prepareProtectedOpen } from '@/src/lib/protectedPdfAccess';

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function DownloadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();

  const [items, setItems] = useState<ProtectedDownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await getAllDownloads();
    setItems(all);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleOpen = useCallback(
    async (record: ProtectedDownloadRecord) => {
      const result = await prepareProtectedOpen(record.assetId);
      if (result.ok) {
        router.push({
          pathname: '/igcse/pdf-reader',
          params: { localUri: result.localUri, bookId: record.assetId, title: record.title },
        } as unknown as Href);
      } else {
        Alert.alert('Cannot open', result.message);
        void load();
      }
    },
    [router, load]
  );

  const handleRemove = useCallback(
    (record: ProtectedDownloadRecord) => {
      Alert.alert('Remove download?', `"${record.title}" will be deleted from this device.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const file = new File(record.localUri);
              if (file.exists) file.delete();
            } catch {
              /* ignore */
            }
            await removeDownload(record.assetId);
            void load();
          },
        },
      ]);
    },
    [load]
  );

  const renderItem = useCallback(
    ({ item }: { item: ProtectedDownloadRecord }) => {
      const expired = isOfflineExpired(item);
      return (
        <View style={[styles.row, { backgroundColor: theme.cardBgColor }]}>
          <TouchableOpacity
            style={styles.rowMain}
            activeOpacity={0.85}
            onPress={() => void handleOpen(item)}>
            <View style={[styles.icon, { backgroundColor: theme.borderColor }]}>
              <MaterialIcons
                name={expired ? 'cloud-off' : 'offline-pin'}
                size={24}
                color={expired ? theme.mutedTextColor : theme.tintColor}
              />
            </View>
            <View style={styles.info}>
              <ThemedText style={[styles.title, { color: theme.textColor }]} numberOfLines={2}>
                {item.title}
              </ThemedText>
              <ThemedText style={[styles.meta, { color: theme.mutedTextColor }]} numberOfLines={1}>
                {[item.subject, formatSize(item.fileSizeBytes)].filter(Boolean).join(' · ')}
              </ThemedText>
              <ThemedText
                style={[
                  styles.status,
                  { color: expired ? '#e67e22' : theme.tintColor },
                ]}>
                {expired ? 'Offline access expired — tap to refresh' : 'Available offline'}
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: theme.borderColor }]}
            onPress={() => handleRemove(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Remove download"
            accessibilityRole="button">
            <MaterialIcons name="delete-outline" size={20} color={theme.mutedTextColor} />
          </TouchableOpacity>
        </View>
      );
    },
    [theme, handleOpen, handleRemove]
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16), borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={theme.tintColor} />
        </TouchableOpacity>
        <ThemedText type="title">My downloads</ThemedText>
        <View style={styles.iconBtn} />
      </View>

      {!loading && items.length === 0 ? (
        <IgcseEmptyState
          icon="download-done"
          title="No downloads yet"
          message="Downloaded IGCSE resources appear here for offline reading inside SmartShelf."
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.assetId}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.tintColor} />
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 6, width: 36 },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12 },
  status: { fontSize: 12, marginTop: 2 },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
