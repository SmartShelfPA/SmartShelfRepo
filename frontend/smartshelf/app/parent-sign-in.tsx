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

export default function ParentSignInScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const getHomeRoute = useAuthStore((s) => s.getHomeRoute);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const user = useAuthStore((s) => s.user);

  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');
  const buttonBgColor = '#00FF41';

  useEffect(() => {
    void getStayLoggedInPreference().then(setStayLoggedIn);
  }, []);

  useEffect(() => {
    if (!isHydrating && isAuthenticated && user?.role === 'parent') {
      router.replace('/parent');
    }
  }, [isHydrating, isAuthenticated, user?.role, router]);

  const handleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signIn(username.trim(), password, { stayLoggedIn });
      const role = useAuthStore.getState().user?.role;
      if (role !== 'parent') {
        await signOut();
        setError('This account is not a parent account. Use an invite code to create a parent account.');
        return;
      }
      router.replace(getHomeRoute());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 20) + 16 }]}
        keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ThemedText style={{ color: tintColor }}>← Back</ThemedText>
        </TouchableOpacity>

        <View style={styles.header}>
          <Image source={require('@/assets/images/ss-logo.png')} style={styles.logo} resizeMode="contain" />
          <ThemedText type="title">Parent sign-in</ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to view your linked child's learning progress.
          </ThemedText>
        </View>

        <ThemedView style={styles.form}>
          <ThemedTextInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isLoading}
          />
          <PasswordInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
          />
          <View style={styles.stayRow}>
            <ThemedText style={{ color: mutedColor, flex: 1 }}>Stay logged in</ThemedText>
            <Switch value={stayLoggedIn} onValueChange={setStayLoggedIn} trackColor={{ true: '#00FF41' }} />
          </View>
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: buttonBgColor }]}
            onPress={handleSignIn}
            disabled={isLoading}>
            <ThemedText style={styles.buttonText}>{isLoading ? 'Signing in…' : 'Sign in'}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <ThemedText style={styles.link}>Forgot password?</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/register-parent' as never)} style={styles.link}>
            <ThemedText style={styles.link}>
              Have an invite code? <ThemedText style={{ fontWeight: '700', color: tintColor }}>Create account</ThemedText>
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 440, alignSelf: 'center', width: '100%' },
  back: { marginBottom: 12 },
  header: { alignItems: 'center', gap: 8, marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 32 },
  subtitle: { textAlign: 'center', opacity: 0.75, fontSize: 15 },
  form: { gap: 16 },
  stayRow: { flexDirection: 'row', alignItems: 'center' },
  button: { paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { fontWeight: '700', color: '#fff' },
  link: { textAlign: 'center', opacity: 0.8, fontSize: 14 },
  error: { color: '#ff4444', fontSize: 13 },
});
