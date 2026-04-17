import React, { useEffect, useState } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface StreakBadgeProps {
  streakDays: number;
}

export function StreakBadge({ streakDays }: StreakBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isTapped, setIsTapped] = useState(false);
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  const badgeBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const streakColor = colorScheme === 'dark' ? '#FFD700' : '#FFA500';

  useEffect(() => {
    if (!isTapped) {
      return;
    }
    const timer = setTimeout(() => setIsTapped(false), 2000);
    return () => clearTimeout(timer);
  }, [isTapped]);

  const isExpanded = isHovered || isTapped;

  return (
    <Pressable
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={() => setIsTapped(true)}
      style={[
        styles.badge,
        { backgroundColor: badgeBgColor, borderColor },
        isExpanded && styles.badgeHovered,
      ]}>
      <MaterialIcons name="local-fire-department" size={18} color={streakColor} />
      <ThemedText style={[styles.badgeText, { color: textColor }]} type="defaultSemiBold">
        {isExpanded ? `${streakDays} day Streak!` : `${streakDays}d`}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeHovered: {
    paddingHorizontal: 14,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
