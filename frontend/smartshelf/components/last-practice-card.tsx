import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface LastPracticeCardProps {
  subject: string;
  exam: 'IGCSE' | 'WAEC';
  year: number;
  paper: string;
  onResume?: () => void;
  onChangePaper?: () => void;
}

export function LastPracticeCard({
  subject,
  exam,
  year,
  paper,
  onResume,
  onChangePaper,
}: LastPracticeCardProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  
  const cardBgColor = colorScheme === 'dark' ? '#1A3A2A' : '#E3F8E3'; // Light green tint instead of blue
  const buttonBgColor = colorScheme === 'dark' ? '#00FF41' : '#00FF41'; // UFO Green
  const buttonTextColor = '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const iconColor = colorScheme === 'dark' ? '#39FF14' : '#00FF41'; // UFO Green variants

  const practiceInfo = `${subject} – ${exam} ${year} – ${paper}`;

  return (
    <ThemedView
      style={[
        styles.container,
        {
          backgroundColor: cardBgColor,
        },
      ]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="history-edu" size={32} color={iconColor} />
        </View>

        <View style={styles.textContainer}>
          <ThemedText style={[styles.label, { color: mutedTextColor }]}>
            Last Practice
          </ThemedText>
          <ThemedText style={[styles.practiceInfo, { color: textColor }]} numberOfLines={2}>
            {practiceInfo}
          </ThemedText>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.resumeButton, { backgroundColor: buttonBgColor }]}
            onPress={onResume || (() => console.log('Resume practice'))}
            activeOpacity={0.8}>
            <ThemedText style={[styles.resumeButtonText, { color: buttonTextColor }]}>
              Resume
            </ThemedText>
          </TouchableOpacity>

          {onChangePaper && (
            <TouchableOpacity
              onPress={onChangePaper}
              activeOpacity={0.7}
              style={styles.changePaperButton}>
              <ThemedText style={[styles.changePaperText, { color: iconColor }]}>
                Change paper
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  practiceInfo: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionsContainer: {
    alignItems: 'flex-end',
    gap: 8,
  },
  resumeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  resumeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  changePaperButton: {
    paddingVertical: 4,
  },
  changePaperText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

