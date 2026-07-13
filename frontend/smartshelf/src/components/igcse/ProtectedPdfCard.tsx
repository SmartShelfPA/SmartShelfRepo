import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import type { ProtectedPdfAsset } from '@/src/api/protectedPdfs';
import type { ProtectedDownloadStatus } from '@/src/hooks/useProtectedPdfDownload';

type Props = {
  asset: ProtectedPdfAsset;
  status: ProtectedDownloadStatus;
  error?: string | null;
  onPrimary: () => void;
  onDownload: () => void;
  onRemove: () => void;
  onAddToCollection?: () => void;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  cardBg: string;
  tagBg: string;
};

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ProtectedPdfCard({
  asset,
  status,
  error,
  onPrimary,
  onDownload,
  onRemove,
  onAddToCollection,
  textColor,
  mutedColor,
  tintColor,
  cardBg,
  tagBg,
}: Props) {
  const isBusy = status === 'authorizing' || status === 'downloading';
  const isOffline = status === 'done' || status === 'expired';

  const statusLabel = (() => {
    switch (status) {
      case 'authorizing':
        return 'Authorizing…';
      case 'downloading':
        return 'Downloading…';
      case 'done':
        return 'Available offline';
      case 'expired':
        return 'Tap to refresh offline access';
      case 'revoked':
        return error || 'Access revoked';
      case 'failed':
        return error || 'Download failed — tap to retry';
      default:
        return formatSize(asset.file_size_bytes) || 'Tap to download';
    }
  })();

  const statusColor =
    status === 'revoked' || status === 'failed'
      ? '#e53935'
      : status === 'done'
        ? tintColor
        : mutedColor;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <TouchableOpacity
        style={styles.main}
        activeOpacity={0.85}
        onPress={onPrimary}
        disabled={isBusy}>
        <View style={styles.iconWrap}>
          <View style={[styles.icon, { backgroundColor: tagBg }]}>
            <MaterialIcons name="picture-as-pdf" size={26} color={tintColor} />
          </View>
          {isOffline ? (
            <View style={[styles.offlineBadge, { backgroundColor: tintColor }]}>
              <MaterialIcons name="offline-pin" size={11} color="#000" />
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <ThemedText style={[styles.title, { color: textColor }]} numberOfLines={2}>
            {asset.title}
          </ThemedText>
          {asset.subject ? (
            <ThemedText style={[styles.subject, { color: mutedColor }]} numberOfLines={1}>
              {asset.subject}
            </ThemedText>
          ) : null}
          <View style={styles.statusRow}>
            {isBusy ? <ActivityIndicator size="small" color={tintColor} /> : null}
            <ThemedText style={[styles.status, { color: statusColor }]} numberOfLines={1}>
              {statusLabel}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>

      {onAddToCollection ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: tagBg }]}
          onPress={onAddToCollection}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Add to collection"
          accessibilityRole="button">
          <MaterialIcons name="collections-bookmark" size={20} color={tintColor} />
        </TouchableOpacity>
      ) : null}

      {/* Trailing action */}
      {isBusy ? null : isOffline ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: tagBg }]}
          onPress={onRemove}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Remove offline copy"
          accessibilityRole="button">
          <MaterialIcons name="delete-outline" size={20} color={mutedColor} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: tagBg }]}
          onPress={onDownload}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Download for offline use"
          accessibilityRole="button">
          <MaterialIcons
            name={status === 'failed' || status === 'revoked' ? 'refresh' : 'cloud-download'}
            size={20}
            color={tintColor}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { position: 'relative' },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  subject: { fontSize: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  status: { fontSize: 12, flexShrink: 1 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
