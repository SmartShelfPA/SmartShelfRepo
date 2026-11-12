import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PasswordInput } from '@/components/password-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { changePassword } from '@/services/api';
import { useRequireAuth } from '@/src/hooks/useRequireRole';
import { useAuthStore } from '@/src/store/auth';

function passwordRuleError(value: string): string | null {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
  if (!/[^a-zA-Z0-9]/.test(value)) return 'Password must contain at least one special character';
  return null;
}

export default function ChangePasswordScreen() {
  const ready = useRequireAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goHome = useAuthStore((s) => s.getHomeRoute);
  const backgroundColor = useThemeColor({}, 'background');
  const buttonBgColor = '#00FF41';
  const buttonTextColor = '#111111';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(goHome());
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    const ruleError = passwordRuleError(newPassword);
    if (ruleError) {
      setError(ruleError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Choose a password that is different from your current one.');
      return;
    }
    setIsLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password updated. Use it the next time you sign in.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not change password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 20) + 12 }]}
        keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Change password
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              This updates the password for the account you are signed in with.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <PasswordInput
              style={styles.input}
              placeholder="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <PasswordInput
              style={styles.input}
              placeholder="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <PasswordInput
              style={styles.input}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />

            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
            {success ? <ThemedText style={styles.successText}>{success}</ThemedText> : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonBgColor }]}
              onPress={() => void handleSave()}
              disabled={isLoading}
              activeOpacity={0.8}>
              <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
                {isLoading ? 'Saving...' : 'Save password'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={goBack} disabled={isLoading}>
              <ThemedText style={styles.linkText}>Back</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  header: { marginBottom: 28, alignItems: 'center', gap: 8 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 15, opacity: 0.7 },
  form: { gap: 14 },
  input: { width: '100%' },
  button: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  linkButton: { paddingVertical: 8, alignItems: 'center' },
  linkText: { fontSize: 14, opacity: 0.8 },
  errorText: { color: '#ff4444', fontSize: 13 },
  successText: { color: '#00b23a', fontSize: 13 },
});
