import { useEffect, useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PasswordInput } from '@/components/password-input';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  redeemParentInvite,
  verifyParentInviteCode,
  type ParentInvitePreview,
} from '@/src/api/parentInvite';
import { useAuthStore } from '@/src/store/auth';

type Step = 'code' | 'account';

export default function RegisterParentScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const getHomeRoute = useAuthStore((s) => s.getHomeRoute);

  const [step, setStep] = useState<Step>('code');
  const [inviteCode, setInviteCode] = useState('');
  const [preview, setPreview] = useState<ParentInvitePreview | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const muted = useThemeColor({}, 'icon');
  const buttonBg = '#00FF41';

  useEffect(() => {
    if (typeof params.code === 'string' && params.code.trim()) {
      setInviteCode(params.code.trim().toUpperCase());
    }
  }, [params.code]);

  const handleVerify = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 6) {
      setError('Enter the invite code from your school or email.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await verifyParentInviteCode(code);
      setPreview(result);
      setStep('account');
      if (result.invite_email_hint) {
        setForm((f) => ({ ...f, email: '' }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!termsAccepted) {
      setError('Accept the Terms of Use and Privacy Policy to continue.');
      return;
    }
    if (!form.full_name.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
      setError('Complete all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await redeemParentInvite({
        code: inviteCode,
        ...form,
        terms_accepted: true,
      });
      useAuthStore.setState({
        token: result.token,
        user: result.user,
        isAuthenticated: true,
      });
      router.replace(getHomeRoute());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
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

        <ThemedText type="title" style={styles.title}>
          Parent Access
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          {step === 'code'
            ? 'Enter the invite code from your school or email to link to your child.'
            : 'Create your parent account to view your child\'s learning progress.'}
        </ThemedText>

        {step === 'code' ? (
          <ThemedView style={styles.form}>
            <ThemedView style={[styles.infoCard, { backgroundColor: cardBg }]}>
              <MaterialIcons name="mail-outline" size={22} color={tintColor} />
              <ThemedText style={styles.infoBody}>
                Your child's student account must already exist. A teacher or admin sends you an
                invite code by email or QR before you can sign up.
              </ThemedText>
            </ThemedView>

            <ThemedText style={styles.label}>Invite code</ThemedText>
            <ThemedTextInput
              placeholder="e.g. AB12CD34"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.codeInput}
            />

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonBg }]}
              onPress={handleVerify}
              disabled={loading}>
              <ThemedText style={styles.buttonText}>
                {loading ? 'Verifying…' : 'Verify code'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/parent-sign-in' as never)} style={styles.altLink}>
              <ThemedText style={styles.altText}>
                Already have a parent account?{' '}
                <ThemedText style={{ fontWeight: '700', color: tintColor }}>Sign in</ThemedText>
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ) : (
          <ThemedView style={styles.form}>
            {preview ? (
              <ThemedView style={[styles.previewCard, { backgroundColor: cardBg, borderColor: muted }]}>
                <ThemedText style={styles.previewTitle}>Linking to</ThemedText>
                <ThemedText style={styles.previewChild}>{preview.child_display_name}</ThemedText>
                <ThemedText style={[styles.previewMeta, { color: muted }]}>
                  {preview.school_name}
                </ThemedText>
                {preview.invite_email_hint ? (
                  <ThemedText style={[styles.previewMeta, { color: muted }]}>
                    Invite sent to: {preview.invite_email_hint}
                  </ThemedText>
                ) : null}
              </ThemedView>
            ) : null}

            <Field label="Full name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <Field label="Username" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} />
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              keyboardType="email-address"
              hint={preview?.invite_email_hint ? 'Use the email that received the invite' : undefined}
            />
            <ThemedText style={styles.label}>Password</ThemedText>
            <PasswordInput
              value={form.password}
              onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
              placeholder="Create a password"
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setTermsAccepted((v) => !v)}>
              <View style={[styles.checkbox, { borderColor: tintColor, backgroundColor: termsAccepted ? tintColor : 'transparent' }]}>
                {termsAccepted ? <ThemedText style={styles.check}>✓</ThemedText> : null}
              </View>
              <ThemedText style={styles.checkboxLabel}>
                I agree to the Terms of Use and Privacy Policy (required)
              </ThemedText>
            </TouchableOpacity>

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonBg }]}
              onPress={handleCreateAccount}
              disabled={loading}>
              <ThemedText style={styles.buttonText}>
                {loading ? 'Creating account…' : 'Create parent account'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('code')}>
              <ThemedText style={[styles.altText, { color: tintColor }]}>← Use a different code</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType = 'default',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'email-address';
  hint?: string;
}) {
  return (
    <ThemedView style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedTextInput value={value} onChangeText={onChange} keyboardType={keyboardType} autoCapitalize="none" />
      {hint ? <ThemedText style={styles.hint}>{hint}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 440, alignSelf: 'center', width: '100%' },
  back: { marginBottom: 12 },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', opacity: 0.75, marginBottom: 20, lineHeight: 21 },
  form: { gap: 14 },
  infoCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,255,65,0.25)' },
  infoBody: { flex: 1, fontSize: 13, lineHeight: 19 },
  label: { fontSize: 14, fontWeight: '600' },
  codeInput: { letterSpacing: 2, fontWeight: '600' },
  button: { paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  buttonText: { fontWeight: '700', color: '#fff' },
  error: { color: '#ff4444', fontSize: 13 },
  altLink: { alignItems: 'center', paddingVertical: 12 },
  altText: { textAlign: 'center', opacity: 0.8, fontSize: 14 },
  previewCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 4, marginBottom: 4 },
  previewTitle: { fontSize: 12, fontWeight: '600', opacity: 0.7, letterSpacing: 0.5 },
  previewChild: { fontSize: 20, fontWeight: '700' },
  previewMeta: { fontSize: 13 },
  field: { gap: 6 },
  hint: { fontSize: 11, opacity: 0.65 },
  checkboxRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 13, fontWeight: '700', color: '#000' },
  checkboxLabel: { flex: 1, fontSize: 13, lineHeight: 20 },
});
