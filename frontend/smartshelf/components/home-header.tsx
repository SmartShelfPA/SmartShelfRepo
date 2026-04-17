import React from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface HomeHeaderProps {
  userInitials?: string;
  avatarUri?: string;
  rightContent?: React.ReactNode;
}

export function HomeHeader({ userInitials = 'AS', avatarUri, rightContent }: HomeHeaderProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  
  const avatarBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  return (
    <ThemedView
      style={[
        styles.container,
        { backgroundColor, paddingTop: Math.max(insets.top, 16) },
      ]}>
      <View style={styles.content}>
        {/* Left: App Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/ss-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.spacer} />
        {/* Right: Custom Content or Profile Avatar */}
        {rightContent ? (
          <View style={styles.rightContainer}>{rightContent}</View>
        ) : (
          <View style={[styles.avatarContainer, { backgroundColor: avatarBgColor }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <Text style={[styles.avatarText, { color: textColor }]}>
                {userInitials}
              </Text>
            )}
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: {
    flex: 1,
  },
  logoContainer: {
    width: 40,
    height: 40,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  rightContainer: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

