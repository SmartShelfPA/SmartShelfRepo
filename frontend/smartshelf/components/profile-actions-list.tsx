import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface ProfileAction {
  id: string;
  label: string;
  icon?: string; // MaterialIcons name
  isDanger?: boolean;
  onPress: () => void;
}

export interface ProfileActionsListProps {
  actions: ProfileAction[];
}

export function ProfileActionsList({ actions }: ProfileActionsListProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const colorScheme = useColorScheme();
  
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#F5F5F5';
  const dividerColor = colorScheme === 'dark' ? '#2A2A2A' : '#E0E0E0';
  const dangerColor = colorScheme === 'dark' ? '#FF6B6B' : '#DC3545';

  return (
    <ThemedView style={[styles.container, { backgroundColor: cardBgColor }]}>
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={action.onPress}
            activeOpacity={0.7}>
            <View style={styles.actionContent}>
              {action.icon && (
                <MaterialIcons
                  name={action.icon as any}
                  size={24}
                  color={action.isDanger ? dangerColor : iconColor}
                  style={styles.actionIcon}
                />
              )}
              <ThemedText
                style={[
                  styles.actionLabel,
                  { color: action.isDanger ? dangerColor : textColor },
                ]}>
                {action.label}
              </ThemedText>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={action.isDanger ? dangerColor : iconColor}
            />
          </TouchableOpacity>
          {index < actions.length - 1 && (
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          )}
        </React.Fragment>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    marginRight: 12,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: 16,
  },
});

