import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import type { IgcsTextbook } from '@/src/types/igcse';

type Props = {
  book: IgcsTextbook;
  onOpen: () => void;
  onDetails?: () => void;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  cardBg: string;
  tagBg: string;
  disabled?: boolean;
};

export function IgcseTextbookCard({
  book,
  onOpen,
  onDetails,
  textColor,
  mutedColor,
  tintColor,
  cardBg,
  tagBg,
  disabled = false,
}: Props) {
  return (
    <View style={[styles.card, { backgroundColor: cardBg, shadowColor: '#000', opacity: disabled ? 0.5 : 1 }]}>
      <TouchableOpacity
        style={styles.main}
        onPress={onOpen}
        activeOpacity={0.85}
        disabled={disabled}>
        <View style={[styles.icon, { backgroundColor: tagBg }]}>
          <MaterialIcons name="menu-book" size={28} color={tintColor} />
        </View>
        <ThemedText style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {book.title}
        </ThemedText>
        <ThemedText style={[styles.meta, { color: mutedColor }]}>{book.subject}</ThemedText>
        {typeof book.progressPercent === 'number' ? (
          <View style={[styles.progressTrack, { backgroundColor: tagBg }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: tintColor,
                  width: `${Math.min(100, Math.max(0, book.progressPercent))}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </TouchableOpacity>
      {onDetails ? (
        <TouchableOpacity
          style={[styles.infoBtn, { backgroundColor: tagBg }]}
          onPress={onDetails}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Book details">
          <MaterialIcons name="info-outline" size={20} color={tintColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 12,
    position: 'relative',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  main: {
    borderRadius: 12,
    padding: 16,
    paddingRight: 40,
    gap: 8,
  },
  infoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: '100%', borderRadius: 999 },
});
