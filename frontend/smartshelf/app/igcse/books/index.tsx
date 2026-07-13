import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
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
  ProtectedPdfCard,
} from '@/src/components/igcse';
import { useIgcsScreenTheme } from '@/src/hooks/igcse';
import { useProtectedPdfs } from '@/src/hooks/useProtectedPdfs';
import { useProtectedPdfDownload } from '@/src/hooks/useProtectedPdfDownload';
import type { ProtectedPdfAsset } from '@/src/api/protectedPdfs';
import { CollectionPickerModal } from '@/src/components/CollectionPickerModal';
import { ensureIgcsBookInStore, igcseBookId } from '@/src/lib/igcseBook';

function ProtectedBookItem({
  asset,
  theme,
  onOpen,
}: {
  asset: ProtectedPdfAsset;
  theme: ReturnType<typeof useIgcsScreenTheme>;
  onOpen: (asset: ProtectedPdfAsset, localUri: string) => void;
}) {
  const { status, error, download, remove, prepareOpen } = useProtectedPdfDownload(asset);
  const [pickerVisible, setPickerVisible] = useState(false);

  const handlePrimary = useCallback(async () => {
    if (status === 'done' || status === 'expired') {
      const result = await prepareOpen();
      if (result.ok) {
        onOpen(asset, result.localUri);
      } else if (result.reason === 'stale') {
        Alert.alert('Update available', result.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Download', onPress: () => void download() },
        ]);
      } else if (result.reason === 'not_downloaded') {
        void download();
      } else {
        Alert.alert('Cannot open', result.message);
      }
      return;
    }
    void download();
  }, [status, prepareOpen, onOpen, asset, download]);

  const handleRemove = useCallback(() => {
    Alert.alert('Remove offline copy?', `"${asset.title}" will be deleted from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void remove() },
    ]);
  }, [asset.title, remove]);

  const handleAddToCollection = useCallback(() => {
    ensureIgcsBookInStore(asset);
    setPickerVisible(true);
  }, [asset]);

  return (
    <>
      <ProtectedPdfCard
        asset={asset}
        status={status}
        error={error}
        onPrimary={handlePrimary}
        onDownload={() => void download()}
        onRemove={handleRemove}
        onAddToCollection={handleAddToCollection}
        textColor={theme.textColor}
        mutedColor={theme.mutedTextColor}
        tintColor={theme.tintColor}
        cardBg={theme.cardBgColor}
        tagBg={theme.borderColor}
      />
      <CollectionPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        bookIds={[igcseBookId(asset.id)]}
        cardBg={theme.cardBgColor}
        tagBg={theme.borderColor}
        textColor={theme.textColor}
        mutedColor={theme.mutedTextColor}
        tintColor={theme.tintColor}
      />
    </>
  );
}

export default function IgcseTextbooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useIgcsScreenTheme();
  const { assets, isLoading, error, refetch, empty } = useProtectedPdfs();

  const handleOpen = useCallback(
    (asset: ProtectedPdfAsset, localUri: string) => {
      router.push({
        pathname: '/igcse/pdf-reader',
        params: { localUri, bookId: asset.id, title: asset.title },
      } as unknown as Href);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ProtectedPdfAsset }) => (
      <ProtectedBookItem asset={item} theme={theme} onOpen={handleOpen} />
    ),
    [theme, handleOpen]
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 16), borderBottomColor: theme.borderColor },
        ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={theme.tintColor} />
        </TouchableOpacity>
        <ThemedText type="title">IGCSE textbooks</ThemedText>
        <TouchableOpacity
          onPress={() => router.push('/downloads' as Href)}
          style={styles.iconBtn}
          activeOpacity={0.8}
          accessibilityLabel="My downloads">
          <MaterialIcons name="download-done" size={22} color={theme.tintColor} />
        </TouchableOpacity>
      </View>
      <ThemedText style={[styles.subtitle, { color: theme.mutedTextColor }]}>
        Protected resources · download to read offline inside SmartShelf
      </ThemedText>

      {isLoading ? (
        <IgcseListSkeleton
          message="Loading resources…"
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
          icon="picture-as-pdf"
          title="No resources yet"
          message="Protected IGCSE PDFs published by your admin will appear here."
          actionLabel="Refresh"
          onAction={() => void refetch()}
          mutedColor={theme.mutedTextColor}
          tintColor={theme.tintColor}
        />
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
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
  iconBtn: { padding: 6 },
  subtitle: { paddingHorizontal: 16, marginTop: 8, marginBottom: 12, fontSize: 14 },
  list: { paddingHorizontal: 16, gap: 12 },
});
