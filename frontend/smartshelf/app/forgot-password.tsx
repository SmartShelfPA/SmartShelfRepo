import { useEffect, useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PasswordInput } from '@/components/password-input';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { confirmPasswordReset, requestPasswordResetCode } from '@/services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, 'background');
  const buttonBgColor = '#00FF41';
  const buttonTextColor = '#FFFFFF';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setResendSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSecondsLeft]);

  const handleRequestCode = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setDebugCode(null);
    try {
      const result = await requestPasswordResetCode(email);
      setStep('confirm');
      setSuccess(result.message);
      setDebugCode(result.debugResetCode ?? null);
      setResendSecondsLeft(30);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim() || !code.trim() || !newPassword) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await confirmPasswordReset(email, code, newPassword);
      setSuccess('Password updated successfully. You can now sign in.');
      setTimeout(() => {
        router.replace('/login');
      }, 800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
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
            <ThemedText type="title" style={styles.title}>
              Forgot password
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Enter your email to receive a reset code, then choose a new password.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <ThemedTextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />

            {step === 'confirm' ? (
              <>
                <ThemedTextInput
                  style={styles.input}
                  placeholder="6-digit reset code"
                  value={code}
                  onChangeText={handleCodeChange}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={6}
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
              </>
            ) : null}

            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
            {success ? <ThemedText style={styles.successText}>{success}</ThemedText> : null}
            {debugCode ? (
              <ThemedText style={styles.debugText}>Dev reset code: {debugCode}</ThemedText>
            ) : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonBgColor }]}
              onPress={step === 'request' ? handleRequestCode : handleResetPassword}
              disabled={isLoading}
              activeOpacity={0.8}>
              <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
                {isLoading
                  ? 'Please wait...'
                  : step === 'request'
                    ? 'Send reset code'
                    : 'Update password'}
              </ThemedText>
            </TouchableOpacity>

            {step === 'confirm' ? (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleRequestCode}
                disabled={isLoading || resendSecondsLeft > 0}>
                <ThemedText style={styles.linkText}>
                  {resendSecondsLeft > 0 ? `Resend code in ${resendSecondsLeft}s` : 'Resend code'}
                </ThemedText>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/login')}
              disabled={isLoading}>
              <ThemedText style={styles.linkText}>Back to sign in</ThemedText>
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
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 28,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    opacity: 0.7,
  },
  form: {
    gap: 14,
  },
  input: {
    width: '100%',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    opacity: 0.8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 13,
  },
  successText: {
    color: '#00b23a',
    fontSize: 13,
  },
  debugText: {
    color: '#cc7a00',
    fontSize: 13,
    fontWeight: '600',
  },
});
