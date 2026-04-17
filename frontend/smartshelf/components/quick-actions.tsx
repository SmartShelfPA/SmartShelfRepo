import React from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface QuickActionsProps {
  onAddTextbook?: () => void;
  onScanTextbook?: () => void;
  onPracticeIGCSE?: () => void;
  onPracticeWAEC?: () => void;
}

export function QuickActions({
  onAddTextbook,
  onScanTextbook,
  onPracticeIGCSE,
  onPracticeWAEC,
}: QuickActionsProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const colorScheme = useColorScheme();
  
  const buttonBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#F5F5F5';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green

  const actions = [
    {
      id: 'add-textbook',
      label: 'Add Textbook',
      icon: 'add-circle-outline',
      onPress: onAddTextbook || (() => console.log('Add Textbook')),
    },
    {
      id: 'scan-textbook',
      label: 'Scan Textbook',
      icon: 'qr-code-scanner',
      onPress: onScanTextbook || (() => console.log('Scan Textbook')),
    },
    {
      id: 'practice-igcse',
      label: 'Practice IGCSE',
      icon: 'school',
      onPress: onPracticeIGCSE || (() => console.log('Practice IGCSE')),
    },
    {
      id: 'practice-waec',
      label: 'Practice WAEC',
      icon: 'assignment',
      onPress: onPracticeWAEC || (() => console.log('Practice WAEC')),
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={styles.actionsGrid}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: buttonBgColor,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={action.onPress}>
            <MaterialIcons name={action.icon as any} size={28} color={tintColor} />
            <ThemedText style={[styles.actionLabel, { color: textColor }]}>
              {action.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    aspectRatio: 1.2,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

