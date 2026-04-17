import React from 'react';
import { View, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface ParentSummaryCardsProps {
  totalChildren: number;
  totalItemsTracked: number;
  lowStockShelves?: number;
}

export function ParentSummaryCards({
  totalChildren,
  totalItemsTracked,
  lowStockShelves = 0,
}: ParentSummaryCardsProps) {
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const tagBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const cards = [
    {
      icon: 'people' as const,
      value: totalChildren,
      label: 'Children',
    },
    {
      icon: 'inventory-2' as const,
      value: totalItemsTracked,
      label: 'Items Tracked',
    },
    {
      icon: 'warning' as const,
      value: lowStockShelves,
      label: 'Low Stock Shelves',
    },
  ];

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.sectionTitle, { color: mutedTextColor }]}>
        OVERVIEW
      </ThemedText>
      <View style={styles.row}>
        {cards.map((card) => (
          <View
            key={card.label}
            style={[styles.card, { backgroundColor: cardBgColor, borderColor: tagBgColor }]}>
            <MaterialIcons name={card.icon} size={24} color={tintColor} />
            <ThemedText style={[styles.value, { color: textColor }]}>{card.value}</ThemedText>
            <ThemedText style={[styles.label, { color: mutedTextColor }]}>{card.label}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: 80,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
  },
});
