/**
 * GoogleSignInButton
 *
 * Renders a "Continue with Google" button styled to match SmartShelf's dark UI.
 * Shows a "not configured" notice in development when client IDs are missing.
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  isConfigured?: boolean;
};

export function GoogleSignInButton({
  onPress,
  isLoading = false,
  disabled = false,
  isConfigured = true,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bg = isDark ? '#1e1e1e' : '#ffffff';
  const border = isDark ? '#333' : '#ddd';
  const textColor = isDark ? '#e8eaed' : '#1f1f1f';

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: bg, borderColor: border }]}
        onPress={onPress}
        disabled={disabled || isLoading || !isConfigured}
        activeOpacity={0.8}>
        {isLoading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            {/* Google "G" logo using coloured squares — no image asset needed. */}
            <GoogleGLogo />
            <ThemedText style={[styles.label, { color: textColor }]}>
              Continue with Google
            </ThemedText>
          </>
        )}
      </TouchableOpacity>

      {!isConfigured && __DEV__ ? (
        <ThemedText style={styles.notice}>
          Google Sign-In: set EXPO_PUBLIC_GOOGLE_CLIENT_ID_* in .env to enable.
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Minimal 18 × 18 Google "G" rendered with coloured Views — no SVG dep needed. */
function GoogleGLogo() {
  return (
    <View style={logo.container}>
      <View style={[logo.segment, logo.topRight]} />
      <View style={[logo.segment, logo.right]} />
      <View style={[logo.segment, logo.bottomRight]} />
      <View style={[logo.segment, logo.bottom]} />
      <View style={[logo.segment, logo.bottomLeft]} />
      <View style={[logo.segment, logo.left]} />
      <View style={[logo.segment, logo.topLeft]} />
      <View style={[logo.segment, logo.top]} />
      <View style={logo.hole} />
      {/* Horizontal bar of the G */}
      <View style={logo.bar} />
    </View>
  );
}

const G = 18;
const logo = StyleSheet.create({
  container: { width: G, height: G, position: 'relative' },
  segment: { position: 'absolute', width: G / 3, height: G / 3 },
  top:         { top: 0,         left: G / 3,   backgroundColor: '#4285F4' },
  topRight:    { top: 0,         left: (G / 3) * 2, backgroundColor: '#EA4335' },
  right:       { top: G / 3,    left: (G / 3) * 2, backgroundColor: '#FBBC04' },
  bottomRight: { top: (G / 3) * 2, left: (G / 3) * 2, backgroundColor: '#34A853' },
  bottom:      { top: (G / 3) * 2, left: G / 3, backgroundColor: '#34A853' },
  bottomLeft:  { top: (G / 3) * 2, left: 0, backgroundColor: '#34A853' },
  left:        { top: G / 3,    left: 0, backgroundColor: '#4285F4' },
  topLeft:     { top: 0,         left: 0, backgroundColor: '#4285F4' },
  hole: {
    position: 'absolute',
    width: G / 3,
    height: G / 3,
    top: G / 3,
    left: G / 3,
    backgroundColor: 'transparent',
  },
  bar: {
    position: 'absolute',
    width: G / 3,
    height: G / 6,
    top: G / 3 + G / 12,
    left: G / 3,
    backgroundColor: '#FBBC04',
  },
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  label: { fontSize: 15, fontWeight: '500' },
  notice: { fontSize: 11, textAlign: 'center', opacity: 0.5 },
});
