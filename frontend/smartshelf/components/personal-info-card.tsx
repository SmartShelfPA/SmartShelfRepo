import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface PersonalInfoCardProps {
  email: string;
  phone?: string;
  timezone?: string;
  pushNotificationsEnabled?: boolean;
  emailUpdatesEnabled?: boolean;
  onPushNotificationsToggle?: (enabled: boolean) => void;
  onEmailUpdatesToggle?: (enabled: boolean) => void;
}

export function PersonalInfoCard({
  email,
  phone,
  timezone,
  pushNotificationsEnabled = false,
  emailUpdatesEnabled = false,
  onPushNotificationsToggle,
  onEmailUpdatesToggle,
}: PersonalInfoCardProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const colorScheme = useColorScheme();
  
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#F5F5F5';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const dividerColor = colorScheme === 'dark' ? '#2A2A2A' : '#E0E0E0';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green

  const [pushNotifications, setPushNotifications] = useState(pushNotificationsEnabled);
  const [emailUpdates, setEmailUpdates] = useState(emailUpdatesEnabled);

  // Sync state when props change
  useEffect(() => {
    setPushNotifications(pushNotificationsEnabled);
  }, [pushNotificationsEnabled]);

  useEffect(() => {
    setEmailUpdates(emailUpdatesEnabled);
  }, [emailUpdatesEnabled]);

  const handlePushNotificationsToggle = (value: boolean) => {
    setPushNotifications(value);
    if (onPushNotificationsToggle) {
      onPushNotificationsToggle(value);
    }
  };

  const handleEmailUpdatesToggle = (value: boolean) => {
    setEmailUpdates(value);
    if (onEmailUpdatesToggle) {
      onEmailUpdatesToggle(value);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: cardBgColor }]}>
      {/* Personal Information Section */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]} type="defaultSemiBold">
          Personal Information
        </ThemedText>
        
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: mutedTextColor }]}>Email</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{email}</ThemedText>
        </View>

        {phone && (
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: mutedTextColor }]}>Phone</ThemedText>
            <ThemedText style={[styles.value, { color: textColor }]}>{phone}</ThemedText>
          </View>
        )}

        {timezone && (
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: mutedTextColor }]}>Timezone</ThemedText>
            <ThemedText style={[styles.value, { color: textColor }]}>{timezone}</ThemedText>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />

      {/* Preferences Section */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]} type="defaultSemiBold">
          Preferences
        </ThemedText>
        
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <ThemedText style={[styles.preferenceLabel, { color: textColor }]}>
              Push Notifications
            </ThemedText>
            <ThemedText style={[styles.preferenceDescription, { color: mutedTextColor }]}>
              Receive notifications on your device
            </ThemedText>
          </View>
          <Switch
            value={pushNotifications}
            onValueChange={handlePushNotificationsToggle}
            trackColor={{ false: mutedTextColor, true: tintColor }}
            thumbColor={colorScheme === 'dark' ? '#fff' : '#fff'}
          />
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <ThemedText style={[styles.preferenceLabel, { color: textColor }]}>
              Email Updates
            </ThemedText>
            <ThemedText style={[styles.preferenceDescription, { color: mutedTextColor }]}>
              Receive updates via email
            </ThemedText>
          </View>
          <Switch
            value={emailUpdates}
            onValueChange={handleEmailUpdatesToggle}
            trackColor={{ false: mutedTextColor, true: tintColor }}
            thumbColor={colorScheme === 'dark' ? '#fff' : '#fff'}
          />
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
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  preferenceContent: {
    flex: 1,
    marginRight: 16,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 12,
  },
});

