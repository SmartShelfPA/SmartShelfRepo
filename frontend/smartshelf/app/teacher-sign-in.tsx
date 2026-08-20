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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PasswordInput } from '@/components/password-input';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getStayLoggedInPreference } from '@/services/api';
import { useAuthStore } from '@/src/store/auth';

export default function TeacherSignInScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const getHomeRoute = useAuthStore((s) => s.getHomeRoute);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const user = useAuthStore((s) => s.user);

  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');
  const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const buttonBgColor = '#00FF41';
  const buttonTextColor = '#FFFFFF';

  useEffect(() => {
    void getStayLoggedInPreference().then(setStayLoggedIn);
  }, []);

  useEffect(() => {
    if (!isHydrating && isAuthenticated && user?.role === 'staff') {
      router.replace('/teacher');
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
      if (role !== 'staff') {
        await useAuthStore.getState().signOut();
        setError(
          'This account is not a teacher account. Ask your school admin to create or approve your teacher access.'
        );
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <ThemedText style={{ color: tintColor }}>← Back to student sign up</ThemedText>
        </TouchableOpacity>

        <View style={styles.header}>
          <Image
            source={require('@/assets/images/ss-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="title" style={styles.title}>
            Teacher sign-in
          </ThemedText>
        </View>

        <ThemedView style={[styles.infoCard, { backgroundColor: cardBg }]}>
          <MaterialIcons name="verified-user" size={22} color={tintColor} />
          <View style={styles.infoText}>
            <ThemedText style={styles.infoTitle}>Invite-only access</ThemedText>
            <ThemedText style={styles.infoBody}>
              Your school admin creates or approves teacher accounts. You will receive an invite
              email or temporary password, then sign in here with those credentials.
            </ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={styles.steps}>
          <Step n={1} text="Admin creates or approves your teacher account" />
          <Step n={2} text="You receive an invite email or temporary password" />
          <Step n={3} text="Sign in below — SmartShelf routes you to the Teacher Dashboard" />
        </ThemedView>

        <ThemedView style={styles.form}>
          <ThemedTextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isLoading}
          />
          <PasswordInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
          />
          <View style={styles.stayRow}>
            <ThemedText style={{ color: mutedColor, flex: 1 }}>Stay logged in</ThemedText>
            <Switch
              value={stayLoggedIn}
              onValueChange={setStayLoggedIn}
              trackColor={{ false: '#767577', true: '#00FF41' }}
              thumbColor="#fff"
            />
          </View>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: buttonBgColor }]}
            onPress={handleSignIn}
            disabled={isLoading}>
            <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
              {isLoading ? 'Signing in…' : 'Sign in as teacher'}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/forgot-password')} disabled={isLoading}>
            <ThemedText style={styles.link}>Forgot password?</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <ThemedText style={styles.stepNum}>{n}</ThemedText>
      </View>
      <ThemedText style={styles.stepText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  backRow: { marginBottom: 12 },
  header: { alignItems: 'center', marginBottom: 20, gap: 8 },
  logo: { width: 72, height: 72, borderRadius: 36 },
  title: { textAlign: 'center' },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.25)',
  },
  infoText: { flex: 1, gap: 4 },
  infoTitle: { fontWeight: '700', fontSize: 15 },
  infoBody: { fontSize: 13, lineHeight: 19, opacity: 0.85 },
  steps: { gap: 12, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,255,65,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 13, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, opacity: 0.9 },
  form: { gap: 16, maxWidth: 400, alignSelf: 'center', width: '100%' },
  input: { width: '100%' },
  stayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', opacity: 0.75, fontSize: 13 },
  errorText: { color: '#ff4444', fontSize: 13 },
});
