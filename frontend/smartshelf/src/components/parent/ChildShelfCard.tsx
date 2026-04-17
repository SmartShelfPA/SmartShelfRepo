import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ParentChild, ShelfItemSummary } from '@/src/types/parent';

const ITEMS_TO_SHOW = 5;

function statusStyle(status: ShelfItemSummary['status']) {
  if (status === 'ok') return { backgroundColor: '#00FF4120' };
  if (status === 'low') return { backgroundColor: '#FFA50030' };
  return { backgroundColor: '#FF444430' };
}

export interface ChildShelfCardProps {
  child: ParentChild;
  items: ShelfItemSummary[];
  onOpenChildShelf?: (childId: string, shelfId: string) => void;
}

export function ChildShelfCard({ child, items, onOpenChildShelf }: ChildShelfCardProps) {
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const tagBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const displayedItems = items.slice(0, ITEMS_TO_SHOW);

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: cardBgColor, borderColor: tagBgColor }]}>
        {child.avatarUrl ? (
          <Image source={{ uri: child.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: tagBgColor }]}>
            <MaterialIcons name="person" size={28} color={tintColor} />
          </View>
        )}
        <View style={styles.info}>
          <ThemedText style={[styles.childName, { color: textColor }]} type="defaultSemiBold">
            {child.name}
          </ThemedText>
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <MaterialIcons name="assignment" size={14} color={mutedTextColor} />
              <ThemedText style={[styles.metaText, { color: mutedTextColor }]}>
                {child.currentTasks} active
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="check-circle" size={14} color={tintColor} />
              <ThemedText style={[styles.metaText, { color: mutedTextColor }]}>
                {child.completedTasks} done
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {displayedItems.length > 0 && (
        <View style={styles.itemsList}>
          {displayedItems.map((item) => (
            <View
              key={item.id}
              style={[styles.itemRow, { backgroundColor: cardBgColor, borderColor: tagBgColor }]}>
              <ThemedText style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                {item.name}
              </ThemedText>
              <ThemedText style={[styles.itemQty, { color: mutedTextColor }]}>
                {item.quantity}
              </ThemedText>
              <View style={[styles.statusChip, statusStyle(item.status)]}>
                <ThemedText style={styles.statusText}>{item.status}</ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}

      {onOpenChildShelf && (
        <TouchableOpacity
          style={[styles.viewShelfButton, { backgroundColor: tintColor }]}
          onPress={() => onOpenChildShelf(child.id, child.shelfId)}
          activeOpacity={0.8}>
          <ThemedText style={styles.viewShelfButtonText}>View Shelf</ThemedText>
          <MaterialIcons name="chevron-right" size={18} color="#000" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  childName: {
    fontSize: 16,
  },
  meta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  itemsList: {
    paddingLeft: 62,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  itemName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
  },
  itemQty: {
    fontSize: 12,
    minWidth: 24,
    textAlign: 'right',
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  viewShelfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
    alignSelf: 'flex-start',
    marginLeft: 62,
  },
  viewShelfButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
});
