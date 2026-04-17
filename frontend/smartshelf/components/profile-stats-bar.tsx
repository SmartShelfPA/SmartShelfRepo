import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface ProfileStatsBarProps {
  creditsCompleted?: number;
  gpa?: number;
  courses?: number;
}

export function ProfileStatsBar({
  creditsCompleted = 0,
  gpa = 0.0,
  courses = 0,
}: ProfileStatsBarProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const colorScheme = useColorScheme();
  
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#F5F5F5';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';

  const stats = [
    { value: creditsCompleted.toString(), label: 'Credits Completed' },
    { value: gpa.toFixed(2), label: 'GPA' },
    { value: courses.toString(), label: 'Courses' },
  ];

  return (
    <ThemedView style={[styles.container, { backgroundColor: cardBgColor }]}>
      <View style={styles.statsRow}>
        {stats.map((stat, index) => (
          <View
            key={index}
            style={[
              styles.statItem,
              index < stats.length - 1 && styles.statItemWithBorder,
              { borderRightColor: colorScheme === 'dark' ? '#2A2A2A' : '#E0E0E0' },
            ]}>
            <ThemedText style={[styles.statValue, { color: textColor }]} type="defaultSemiBold">
              {stat.value}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: mutedTextColor }]}>
              {stat.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statItemWithBorder: {
    borderRightWidth: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
});

