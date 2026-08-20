import { useEffect, useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  TouchableOpacity,
  Image,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PasswordInput } from '@/components/password-input';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getStayLoggedInPreference } from '@/services/api';
import { useAuthStore } from '@/src/store/auth';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const getHomeRoute = useAuthStore((s) => s.getHomeRoute);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({}, 'icon');

  const buttonBgColor = '#00FF41';
  const buttonTextColor = '#FFFFFF';

  useEffect(() => {
    void getStayLoggedInPreference().then(setStayLoggedIn);
  }, []);

  useEffect(() => {
    if (!isHydrating && isAuthenticated) {
      router.replace(getHomeRoute());
    }
  }, [isHydrating, isAuthenticated, router, getHomeRoute]);

  const handleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!username.trim() || !password.trim()) {
      setIsLocked(false);
      setError('Please enter your username and password.');
      return;
    }
    setError(null);
    setIsLocked(false);
    setIsLoading(true);
    try {
      await signIn(username.trim(), password, { stayLoggedIn });
      router.replace(getHomeRoute());
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      if (err.code === 'account_locked') {
        setIsLocked(true);
        setError(err.message);
      } else {
        setError(e instanceof Error ? e.message : 'Sign in failed');
      }
      console.error('[Login] Sign in failed:', e);
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
            <PasswordInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <View style={styles.stayRow}>
              <ThemedText style={{ color: mutedColor, flex: 1 }}>Stay logged in</ThemedText>
              <Switch
                value={stayLoggedIn}
                onValueChange={setStayLoggedIn}
                trackColor={{ false: '#767577', true: '#00FF41' }}
                thumbColor="#fff"
                disabled={isLoading}
              />
            </View>
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => router.push('/forgot-password')}
              disabled={isLoading}>
              <ThemedText style={styles.forgotPasswordText}>Forgot password?</ThemedText>
            </TouchableOpacity>
            {isLocked && error ? (
              <View style={styles.lockoutBanner}>
                <ThemedText style={styles.lockoutTitle}>Account temporarily locked</ThemedText>
                <ThemedText style={styles.lockoutBody}>{error}</ThemedText>
                <ThemedText style={styles.lockoutHint}>
                  Too many incorrect password attempts. Please wait and try again, or use
                  "Forgot password?" to reset your credentials.
                </ThemedText>
              </View>
            ) : error ? (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            ) : null}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonBgColor }]}
              onPress={handleSignIn}
              disabled={isLoading}
              activeOpacity={0.8}>
              <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.registerButton} onPress={handleSignUp}>
              <ThemedText style={styles.registerButtonText}>
                Don't have an account?{' '}
                <ThemedText style={[styles.registerButtonText, { fontWeight: '600', opacity: 1 }]}>
                  Sign Up
                </ThemedText>
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/teacher-sign-in')} style={styles.backLink}>
              <ThemedText style={styles.forgotPasswordText}>Teacher Access</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/register-parent' as never)} style={styles.backLink}>
              <ThemedText style={styles.forgotPasswordText}>Parent Access (invite code)</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/parent-sign-in' as never)} style={styles.backLink}>
              <ThemedText style={styles.forgotPasswordText}>Parent sign-in</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    width: 200,
    height: 120,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 200, height: 120 },
  title: { marginBottom: 8, textAlign: 'center', paddingVertical: 4 },
  subtitle: { fontSize: 16, lineHeight: 22, textAlign: 'center', opacity: 0.7 },
  form: { gap: 20 },
  input: { width: '100%' },
  stayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  backLink: {
    marginTop: 4,
    alignItems: 'center',
  },
  registerButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  registerButtonText: { fontSize: 14, opacity: 0.7 },
  forgotPasswordButton: { alignSelf: 'flex-end', marginTop: -8 },
  forgotPasswordText: { fontSize: 13, opacity: 0.8 },
  errorText: { color: '#ff4444', fontSize: 13 },
  lockoutBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cc4400',
    backgroundColor: 'rgba(204,68,0,0.10)',
    padding: 14,
    gap: 6,
  },
  lockoutTitle: { fontSize: 13, fontWeight: '700', color: '#cc4400' },
  lockoutBody: { fontSize: 13, color: '#cc4400' },
  lockoutHint: { fontSize: 12, opacity: 0.75 },
});
