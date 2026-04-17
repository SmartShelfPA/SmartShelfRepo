import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface ParentHeaderProps {
  parentName: string;
  onProfilePress?: () => void;
  onBackPress?: () => void;
}

export function ParentHeader({ parentName, onProfilePress, onBackPress }: ParentHeaderProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const avatarBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: Math.max(insets.top, 16),
          backgroundColor,
        },
      ]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {onBackPress && (
            <TouchableOpacity onPress={onBackPress} style={styles.backButton} activeOpacity={0.8}>
              <MaterialIcons name="arrow-back" size={24} color={tintColor} />
            </TouchableOpacity>
          )}
          <Image
            source={require('@/assets/images/ss-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.titleBlock}>
            <ThemedText style={styles.headerTitle} type="defaultSemiBold">
              SmartShelf
            </ThemedText>
            <ThemedText style={styles.parentName} numberOfLines={1}>
              {parentName}
            </ThemedText>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.profileButton, { backgroundColor: avatarBgColor }]}
          onPress={onProfilePress}
          activeOpacity={0.8}>
          <MaterialIcons name="account-circle" size={28} color={tintColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backButton: {
    padding: 4,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  titleBlock: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
  },
  parentName: {
    fontSize: 14,
    opacity: 0.8,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
