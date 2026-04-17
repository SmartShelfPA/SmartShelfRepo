import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface ExamOverviewCardProps {
  examName: string;
  sessionLabel: string;
  progressPercent: number;
  onContinue: () => void;
}

export function ExamOverviewCard({
  examName,
  sessionLabel,
  progressPercent,
  onContinue,
}: ExamOverviewCardProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const progressBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const progressFillColor = colorScheme === 'dark' ? '#00FF41' : '#00FF41'; // UFO Green
  const buttonBgColor = colorScheme === 'dark' ? '#00FF41' : '#00FF41'; // UFO Green
  const buttonTextColor = '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';

  return (
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor: cardBgColor,
          shadowColor: colorScheme === 'dark' ? '#000' : '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
      ]}>
      <View style={styles.cardContent}>
        <View style={styles.header}>
          <ThemedText style={[styles.examName, { color: textColor }]} type="defaultSemiBold">
            {examName}
          </ThemedText>
          <ThemedText style={[styles.sessionLabel, { color: mutedTextColor }]}>
            {sessionLabel}
          </ThemedText>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: progressBgColor }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                  backgroundColor: progressFillColor,
                },
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: mutedTextColor }]}>
            {progressPercent}% Complete
          </ThemedText>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: buttonBgColor }]}
          onPress={onContinue}
          activeOpacity={0.8}>
          <ThemedText style={[styles.continueButtonText, { color: buttonTextColor }]}>
            Continue
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

export interface ExamOverviewProps {
  igcseCard: Omit<ExamOverviewCardProps, 'examName'>;
  waecCard: Omit<ExamOverviewCardProps, 'examName'>;
}

export function ExamOverview({ igcseCard, waecCard }: ExamOverviewProps) {
  return (
    <View style={styles.container}>
      <ExamOverviewCard examName="IGCSE" {...igcseCard} />
      <ExamOverviewCard examName="WAEC" {...waecCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  examName: {
    fontSize: 20,
    fontWeight: '600',
  },
  sessionLabel: {
    fontSize: 14,
  },
  progressContainer: {
    gap: 6,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

