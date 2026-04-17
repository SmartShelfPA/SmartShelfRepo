import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface ProfileHeaderProps {
  avatarUri?: string;
  fullName: string;
  username?: string;
  studentId?: string;
  program?: string;
  major?: string;
  yearLevel?: string;
}

export function ProfileHeader({
  avatarUri,
  fullName,
  username,
  studentId,
  program,
  major,
  yearLevel,
}: ProfileHeaderProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const colorScheme = useColorScheme();
  
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const avatarBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  // Build program/major display text
  const getProgramDisplayText = (): string => {
    const parts: string[] = [];
    
    // Add program and/or major
    if (program && major) {
      parts.push(`${program} - ${major}`);
    } else if (program) {
      parts.push(program);
    } else if (major) {
      parts.push(major);
    }
    
    // Add year level if available
    if (yearLevel) {
      parts.push(`Year ${yearLevel}`);
    }
    
    return parts.join(' • ');
  };

  const programDisplayText = getProgramDisplayText();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {/* Avatar */}
        <View style={[styles.avatarContainer, { backgroundColor: avatarBgColor }]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: avatarBgColor }]}>
              <ThemedText style={[styles.avatarText, { color: mutedTextColor }]}>
                {fullName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Name and Info */}
        <View style={styles.infoContainer}>
          <ThemedText style={[styles.fullName, { color: textColor }]} type="defaultSemiBold">
            {fullName}
          </ThemedText>
          
          {(username || studentId) && (
            <ThemedText style={[styles.username, { color: mutedTextColor }]}>
              {username || studentId}
            </ThemedText>
          )}
          
          {programDisplayText && (
            <ThemedText style={[styles.program, { color: textColor }]}>
              {programDisplayText}
            </ThemedText>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    gap: 4,
  },
  fullName: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  username: {
    fontSize: 14,
    lineHeight: 18,
  },
  program: {
    fontSize: 16,
    lineHeight: 20,
    marginTop: 2,
  },
});

