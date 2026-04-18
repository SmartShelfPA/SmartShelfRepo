import { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/src/store/auth';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const backgroundColor = useThemeColor({}, 'background');

  const buttonBgColor = '#00FF41'; // SmartShelf green
  const buttonTextColor = '#FFFFFF';

  const handleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!username.trim() || !password.trim()) return;
    setIsLoading(true);
    try {
      await signIn(username.trim(), password);
      router.replace('/account-select');
    } catch (error) {
      console.error('[Login] Sign in failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push('/register');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 20) + 20 }]}
        keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          <ThemedView style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/ss-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <ThemedText type="title" style={styles.title}>
              SmartShelf
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Sign in or create an account
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <ThemedTextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <ThemedTextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: buttonBgColor },
              ]}
              onPress={handleSignIn}
              disabled={isLoading}
              activeOpacity={0.8}>
              <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleSignUp}>
              <ThemedText style={styles.registerButtonText}>
                Don't have an account? <ThemedText style={[styles.registerButtonText, { fontWeight: '600', opacity: 1 }]}>Sign Up</ThemedText>
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    marginBottom: 16,
  },
  logo: {
    width: 140,
    height: 140,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  form: {
    gap: 20,
  },
  input: {
    width: '100%',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: 14,
    opacity: 0.7,
  },
});

