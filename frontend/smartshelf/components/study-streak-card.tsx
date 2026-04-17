import React from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface StudyStreakCardProps {
  streakDays: number;
  motivationalMessage?: string;
  onStartSession?: () => void;
}

export function StudyStreakCard({
  streakDays,
  motivationalMessage,
  onStartSession,
}: StudyStreakCardProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const buttonBgColor = colorScheme === 'dark' ? '#00FF41' : '#00FF41'; // UFO Green
  const buttonTextColor = '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const streakColor = colorScheme === 'dark' ? '#FFD700' : '#FFA500';
  const iconColor = streakColor;

  const defaultMessage = streakDays > 0
    ? `Keep up the great work! You're on fire! 🔥`
    : `Start your study journey today!`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: cardBgColor,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      onPress={onStartSession || (() => console.log('Start session'))}>
      <View style={styles.content}>
        {/* Left: Icon/Emoji */}
        <View style={styles.iconContainer}>
          <MaterialIcons name="local-fire-department" size={40} color={iconColor} />
        </View>

        {/* Right: Text and CTA */}
        <View style={styles.textContainer}>
          <View style={styles.streakContainer}>
            <ThemedText style={[styles.streakNumber, { color: streakColor }]} type="defaultSemiBold">
              {streakDays}
            </ThemedText>
            <ThemedText style={[styles.streakLabel, { color: textColor }]}>
              {streakDays === 1 ? 'day streak' : 'days streak'}
            </ThemedText>
          </View>

          <ThemedText style={[styles.motivationalText, { color: mutedTextColor }]}>
            {motivationalMessage || defaultMessage}
          </ThemedText>

          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: buttonBgColor }]}
            onPress={(e) => {
              e.stopPropagation();
              onStartSession?.();
            }}
            activeOpacity={0.8}>
            <ThemedText style={[styles.ctaButtonText, { color: buttonTextColor }]}>
              Start 15‑min session
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 8,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  motivationalText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ctaButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

