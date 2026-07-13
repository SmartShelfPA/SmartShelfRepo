/**
 * ErrorBoundary
 *
 * Wraps the entire app tree. When a React render error bubbles up:
 *  - Shows a friendly "Something went wrong" screen.
 *  - Reports the error via errorReporter (stored locally, optional backend POST).
 *  - Offers a "Try again" button that resets the boundary, and a "Restart app"
 *    button (on native) that fully reloads.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { reportError } from '@/src/lib/errorReporter';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    void reportError(error, `react_boundary: ${info.componentStack?.slice(0, 200)}`);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleRestart = () => {
    if (Platform.OS !== 'web') {
      // On native we can reload the JS bundle via Updates or simply re-mount.
      // expo-updates is optional — fall back to just resetting the boundary.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Updates = require('expo-updates');
        void Updates.reloadAsync();
      } catch {
        this.handleReset();
      }
    } else {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;
    const isDev = __DEV__;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {/* Simple text icon avoids any third-party icon dependency */}
            <View style={styles.iconCircle}>
              <View style={styles.exclamationBar} />
              <View style={styles.exclamationDot} />
            </View>
          </View>

          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              {['S', 'o', 'm', 'e', 't', 'h', 'i', 'n', 'g', ' ', 'w', 'e', 'n', 't', ' ', 'w', 'r', 'o', 'n', 'g'].map(
                (char, i) => (
                  <View
                    key={i}
                    // eslint-disable-next-line react-native/no-inline-styles
                    style={{ opacity: char === ' ' ? 0 : 1, width: char === ' ' ? 6 : undefined }}
                  />
                )
              )}
            </View>
            {/* Actual readable text rendered below */}
          </View>

          <View style={styles.body}>
            <View style={styles.titleBox}>
              <View style={styles.titleLine} />
              <View style={[styles.titleLine, { width: '85%', marginTop: 8, opacity: 0.6 }]} />
            </View>

            {/* Friendly readable content */}
            <ErrorContent
              error={error}
              isDev={isDev}
              onReset={this.handleReset}
              onRestart={this.handleRestart}
            />
          </View>
        </View>
      </View>
    );
  }
}

type ContentProps = {
  error: Error | null;
  isDev: boolean;
  onReset: () => void;
  onRestart: () => void;
};

function ErrorContent({ error, isDev, onReset, onRestart }: ContentProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}>
      <View style={styles.emojiRow}>
        <View style={styles.emojiBox}>
          {/* bolt icon placeholder */}
        </View>
      </View>

      <View style={styles.heading}>
        <View style={[styles.bar, { width: '70%' }]} />
        <View style={[styles.bar, { width: '50%', marginTop: 6, opacity: 0.5 }]} />
      </View>

      {/* The actual human-readable message — we use raw Text via a function component */}
      <FriendlyMessage error={error} isDev={isDev} />

      <TouchableOpacity style={styles.primaryBtn} onPress={onReset} activeOpacity={0.85}>
        <FriendlyButtonText text="Try again" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={onRestart} activeOpacity={0.85}>
        <FriendlyButtonText text="Restart app" secondary />
      </TouchableOpacity>
    </ScrollView>
  );
}

// Uses a separate function component so it can import ThemedText lazily
// without causing the boundary itself to fail if themed components are broken.
function FriendlyMessage({ error, isDev }: { error: Error | null; isDev: boolean }) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ThemedText } = require('@/components/themed-text');
    return (
      <View style={styles.msgWrap}>
        <ThemedText style={styles.title}>Something went wrong</ThemedText>
        <ThemedText style={styles.subtitle}>
          SmartShelf ran into an unexpected problem. Your progress has been saved.
        </ThemedText>
        {isDev && error ? (
          <View style={styles.devBox}>
            <ThemedText style={styles.devTitle}>Dev info</ThemedText>
            <ThemedText style={styles.devMessage}>{error.message}</ThemedText>
            {error.stack ? (
              <ThemedText style={styles.devStack} numberOfLines={8}>
                {error.stack}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  } catch {
    return null;
  }
}

function FriendlyButtonText({ text, secondary }: { text: string; secondary?: boolean }) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ThemedText } = require('@/components/themed-text');
    return (
      <ThemedText
        style={[styles.btnText, secondary && styles.btnTextSecondary]}>
        {text}
      </ThemedText>
    );
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#141414',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  iconWrap: { alignItems: 'center', paddingTop: 32, paddingBottom: 8 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,68,68,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,68,68,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  exclamationBar: {
    width: 3,
    height: 20,
    backgroundColor: '#ff4444',
    borderRadius: 2,
    marginBottom: 2,
  },
  exclamationDot: {
    width: 4,
    height: 4,
    backgroundColor: '#ff4444',
    borderRadius: 2,
  },
  textWrap: { display: 'none' },
  body: { flex: 1 },
  titleBox: { display: 'none' },
  titleLine: { display: 'none' },
  emojiRow: { display: 'none' },
  emojiBox: { display: 'none' },
  heading: { display: 'none' },
  bar: { display: 'none' },
  scroll: { padding: 24, paddingTop: 8, gap: 16 },
  msgWrap: { gap: 8 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 22, textAlign: 'center', opacity: 0.7 },
  devBox: {
    marginTop: 8,
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  devTitle: { fontSize: 11, fontWeight: '700', color: '#ff6666', letterSpacing: 1 },
  devMessage: { fontSize: 13, color: '#ff9999' },
  devStack: { fontSize: 11, color: '#aaa', lineHeight: 16 },
  primaryBtn: {
    backgroundColor: '#00FF41',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  btnText: { fontSize: 15, fontWeight: '600', color: '#000' },
  btnTextSecondary: { color: '#aaa', fontWeight: '500' },
});
