import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface Achievement {
  id: string;
  name: string;
  icon: string; // MaterialIcons name
  description?: string;
}

export interface AchievementsRowProps {
  achievements: Achievement[];
  onAchievementPress?: (achievement: Achievement) => void;
}

export function AchievementsRow({
  achievements,
  onAchievementPress,
}: AchievementsRowProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const colorScheme = useColorScheme();
  const [selectedAchievement, setSelectedAchievement] = React.useState<Achievement | null>(null);
  
  const badgeBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green

  const handlePress = (achievement: Achievement) => {
    if (onAchievementPress) {
      onAchievementPress(achievement);
    } else {
      setSelectedAchievement(achievement);
    }
  };

  const closeModal = () => {
    setSelectedAchievement(null);
  };

  return (
    <>
      <ThemedView style={styles.container}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]} type="defaultSemiBold">
          Achievements
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {achievements.map((achievement) => (
            <TouchableOpacity
              key={achievement.id}
              style={[styles.badgeContainer, { backgroundColor: badgeBgColor }]}
              onPress={() => handlePress(achievement)}
              activeOpacity={0.7}>
              <View style={[styles.badgeIcon, { backgroundColor: badgeBgColor }]}>
                <MaterialIcons
                  name={achievement.icon as any}
                  size={32}
                  color={tintColor}
                />
              </View>
              <ThemedText
                style={[styles.badgeLabel, { color: textColor }]}
                numberOfLines={2}>
                {achievement.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ThemedView>

      {/* Achievement Detail Modal */}
      <Modal
        visible={selectedAchievement !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <ThemedView
            style={[styles.modalContent, { backgroundColor: backgroundColor }]}
            onStartShouldSetResponder={() => true}>
            {selectedAchievement && (
              <>
                <View style={[styles.modalIconContainer, { backgroundColor: badgeBgColor }]}>
                  <MaterialIcons
                    name={selectedAchievement.icon as any}
                    size={48}
                    color={tintColor}
                  />
                </View>
                <ThemedText
                  style={[styles.modalTitle, { color: textColor }]}
                  type="defaultSemiBold">
                  {selectedAchievement.name}
                </ThemedText>
                {selectedAchievement.description && (
                  <ThemedText style={[styles.modalDescription, { color: mutedTextColor }]}>
                    {selectedAchievement.description}
                  </ThemedText>
                )}
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: badgeBgColor }]}
                  onPress={closeModal}>
                  <ThemedText style={[styles.modalCloseText, { color: textColor }]}>
                    Close
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
          </ThemedView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  badgeContainer: {
    alignItems: 'center',
    width: 90,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 320,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalCloseButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

