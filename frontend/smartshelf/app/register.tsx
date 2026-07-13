import { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PasswordInput } from '@/components/password-input';
import { ThemedTextInput } from '@/components/themed-text-input';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/src/store/auth';
import {
  fetchOrganizations,
  type SchoolOrganization,
} from '@/services/api';
import {
  DEFAULT_SCHOOL_SLUG,
  FALLBACK_DEFAULT_SCHOOL,
} from '@/src/constants/defaultSchool';

/** Age below which we require explicit parental / school consent acknowledgement. */
const COPPA_AGE_GATE = 13;

type SimpleField = 'name' | 'username' | 'email' | 'password';
type ExtraField = 'dateOfBirth' | 'organization' | 'studentClass';

type FormErrors = Record<SimpleField | ExtraField, string | null>;

const emptyErrors = (): FormErrors => ({
  name: null,
  username: null,
  email: null,
  password: null,
  dateOfBirth: null,
  organization: null,
  studentClass: null,
});

function validateDateOfBirth(value: string, required: boolean): string | null {
  if (!required) {
    if (!value.trim()) return null;
  } else if (!value.trim()) {
    return 'Date of birth is required';
  }
  const t = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return 'Use format YYYY-MM-DD';
  }
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return 'Invalid date';
  }
  return null;
}

function parseAge(dob: string): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) return null;
  const d = new Date(`${dob.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  return Math.floor((today.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
  });
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<string | null>(null);

  // Consent state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<SchoolOrganization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);

  const [errors, setErrors] = useState<FormErrors>(emptyErrors());
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const signUp = useAuthStore((state) => state.signUp);
  const getHomeRoute = useAuthStore((state) => state.getHomeRoute);
  const insets = useSafeAreaInsets();
  const currentValuesRef = useRef(formData);

  useEffect(() => {
    currentValuesRef.current = formData;
  }, [formData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOrgsLoading(true);
      setOrgsError(null);
      try {
        const list = await fetchOrganizations();
        if (!cancelled) {
          setOrganizations(list);
          const preferred =
            list.find((o) => o.slug === 'default-school') ?? (list.length === 1 ? list[0] : null);
          if (preferred) {
            setSelectedOrgSlug(preferred.slug);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const detail = e instanceof Error ? e.message : 'Failed to load schools';
          setOrganizations([FALLBACK_DEFAULT_SCHOOL]);
          setSelectedOrgSlug(DEFAULT_SCHOOL_SLUG);
          setOrgsError(
            `${detail} Showing Default School offline — sign-up will work after the app can reach your API (rebuild with a public URL; see docs/MOBILE_API_SETUP.md).`
          );
        }
      } finally {
        if (!cancelled) {
          setOrgsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const inputBackground = useThemeColor(
    { light: Colors.light.background, dark: Colors.dark.background },
    'background'
  );
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const buttonBgColor = '#00FF41';
  const buttonTextColor = '#FFFFFF';

  const selectedOrgName =
    organizations.find((o) => o.slug === selectedOrgSlug)?.name ?? null;

  const validateSimpleField = (fieldName: SimpleField, value: string): string | null => {
    switch (fieldName) {
      case 'name':
        return value.trim() ? null : 'Name is required';
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return null;
      case 'username':
        if (!value.trim()) return 'Username is required';
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed';
        return null;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters long';
        if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
        if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
        if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
        if (!/[^a-zA-Z0-9]/.test(value)) {
          return 'Password must contain at least one special character';
        }
        return null;
      default:
        return null;
    }
  };

  const handleFieldChange = (fieldName: SimpleField, value: string) => {
    const updatedData = { ...formData, [fieldName]: value };
    setFormData(updatedData);
    currentValuesRef.current = updatedData;
    setErrors((prev) => (prev[fieldName] ? { ...prev, [fieldName]: null } : prev));
    setRegisterError(null);
  };

  const handleFieldBlur = (fieldName: SimpleField) => {
    const currentValue = currentValuesRef.current[fieldName];
    const error = validateSimpleField(fieldName, currentValue);
    setErrors((prev) => ({ ...prev, [fieldName]: error }));
  };

  const validateAll = useCallback((): FormErrors => {
    const next = emptyErrors();
    next.name = validateSimpleField('name', formData.name);
    next.username = validateSimpleField('username', formData.username);
    next.email = validateSimpleField('email', formData.email);
    next.password = validateSimpleField('password', formData.password);

    next.dateOfBirth = validateDateOfBirth(dateOfBirth, true);
    if (!studentClass.trim()) {
      next.studentClass = 'Class is required for students';
    }

    if (!selectedOrgSlug) {
      next.organization = 'Select your school or university';
    }

    return next;
  }, [formData, dateOfBirth, studentClass, selectedOrgSlug]);

  const handleSubmit = async () => {
    const newErrors = validateAll();
    setErrors(newErrors);
    setRegisterError(null);
    setConsentError(null);

    // Age gate: warn if student is under COPPA_AGE_GATE but don't hard-block
    // (school/parent consent may have been obtained offline).
    const age = parseAge(dateOfBirth);
    if (age !== null && age < COPPA_AGE_GATE) {
      setRegisterError(
        `Students under ${COPPA_AGE_GATE} must be registered by a parent or school. ` +
        'Ask your teacher or parent/guardian to create the account and link it.'
      );
      return;
    }

    if (!termsAccepted) {
      setConsentError('You must accept the Terms of Use and Privacy Policy to continue.');
      return;
    }

    if (Object.values(newErrors).some((e) => e !== null)) {
      return;
    }

    setIsLoading(true);
    try {
      await signUp({
        full_name: formData.name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: 'student',
        date_of_birth: dateOfBirth.trim() || null,
        student_class: studentClass.trim(),
        organization_slug: selectedOrgSlug ?? undefined,
        terms_accepted: true,
        analytics_consent: analyticsConsent,
      });
      router.replace(getHomeRoute());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      setRegisterError(message);
      console.error('[Register] Failed to register:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setFormData({ name: '', username: '', email: '', password: '' });
    setDateOfBirth('');
    setStudentClass('');
    setSelectedOrgSlug(null);
    setErrors(emptyErrors());
    setRegisterError(null);
    router.push('/login');
  };

  const renderField = (
    fieldName: SimpleField,
    label: string,
    placeholder: string,
    helperText?: string,
    options?: {
      keyboardType?: 'default' | 'email-address' | 'numeric';
      autoCapitalize?: 'none' | 'words' | 'sentences';
      secureTextEntry?: boolean;
    }
  ) => (
    <ThemedView style={styles.inputContainer} key={fieldName}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {options?.secureTextEntry ? (
        <PasswordInput
          style={[styles.input, errors[fieldName] && styles.inputError]}
          placeholder={placeholder}
          value={formData[fieldName]}
          onChangeText={(text) => handleFieldChange(fieldName, text)}
          onBlur={() => handleFieldBlur(fieldName)}
          editable={!isLoading}
          autoCapitalize={options?.autoCapitalize || 'none'}
          autoCorrect={false}
        />
      ) : (
        <ThemedTextInput
          style={[styles.input, errors[fieldName] && styles.inputError]}
          placeholder={placeholder}
          value={formData[fieldName]}
          onChangeText={(text) => handleFieldChange(fieldName, text)}
          onBlur={() => handleFieldBlur(fieldName)}
          editable={!isLoading}
          keyboardType={options?.keyboardType || 'default'}
          autoCapitalize={options?.autoCapitalize || 'none'}
          autoCorrect={false}
        />
      )}
      {errors[fieldName] && <ThemedText style={styles.errorText}>{errors[fieldName]}</ThemedText>}
      {helperText && !errors[fieldName] && (
        <ThemedText style={styles.helperText}>{helperText}</ThemedText>
      )}
    </ThemedView>
  );

  const pickerBorderColor = errors.organization ? '#ff4444' : iconColor;

  const renderOrgPicker = () => (
    <ThemedView style={styles.inputContainer}>
      <ThemedText style={styles.label}>School or university</ThemedText>
      <Pressable
        onPress={() => !orgsLoading && organizations.length > 0 && setOrgPickerOpen(true)}
        disabled={isLoading || orgsLoading || organizations.length === 0}
        style={({ pressed }) => [
          styles.pickerShell,
          {
            borderColor: pickerBorderColor,
            backgroundColor: inputBackground,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <ThemedText
          style={{
            color: selectedOrgName ? textColor : iconColor,
            flex: 1,
          }}>
          {orgsLoading
            ? 'Loading schools…'
            : organizations.length === 0
              ? orgsError
                ? 'Could not load schools'
                : 'No schools available — run backend migrations'
              : selectedOrgName ?? 'Tap to select your school'}
        </ThemedText>
        {orgsLoading ? <ActivityIndicator color={tintColor} /> : null}
      </Pressable>
      {errors.organization ? (
        <ThemedText style={styles.errorText}>{errors.organization}</ThemedText>
      ) : null}
      {orgsError ? <ThemedText style={styles.errorText}>{orgsError}</ThemedText> : null}
    </ThemedView>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedView style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title} numberOfLines={2}>
                Student sign up
              </ThemedText>
            </ThemedView>
            <ThemedText style={styles.subtitle}>
              Create your student account and pick your school
            </ThemedText>
          </ThemedView>

          {registerError ? (
            <ThemedView style={styles.bannerError}>
              <ThemedText style={styles.bannerErrorText}>{registerError}</ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.form}>
            {renderOrgPicker()}

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Date of birth</ThemedText>
              <ThemedTextInput
                style={[styles.input, errors.dateOfBirth && styles.inputError]}
                placeholder="YYYY-MM-DD"
                value={dateOfBirth}
                onChangeText={(t) => {
                  setDateOfBirth(t);
                  setErrors((e) => (e.dateOfBirth ? { ...e, dateOfBirth: null } : e));
                  setRegisterError(null);
                }}
                editable={!isLoading}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.dateOfBirth ? (
                <ThemedText style={styles.errorText}>{errors.dateOfBirth}</ThemedText>
              ) : (
                <ThemedText style={styles.helperText}>Example: 2008-03-21</ThemedText>
              )}
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Class</ThemedText>
              <ThemedTextInput
                style={[styles.input, errors.studentClass && styles.inputError]}
                placeholder="Enter your class (e.g. Grade 8A)"
                value={studentClass}
                onChangeText={(t) => {
                  setStudentClass(t);
                  setErrors((e) => (e.studentClass ? { ...e, studentClass: null } : e));
                  setRegisterError(null);
                }}
                editable={!isLoading}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {errors.studentClass ? (
                <ThemedText style={styles.errorText}>{errors.studentClass}</ThemedText>
              ) : null}
            </ThemedView>

            {renderField('name', 'Full name', 'Enter your full name', undefined, {
              autoCapitalize: 'words',
            })}
            {renderField('username', 'Username', 'Your first name + School initials', undefined, {
              autoCapitalize: 'none',
            })}
            {renderField('email', 'Email', 'Your email address', undefined, {
              keyboardType: 'email-address',
            })}
            {renderField(
              'password',
              'Password',
              'Enter your password',
              '8+ characters with upper, lower, number, and special character',
              { secureTextEntry: true, autoCapitalize: 'none' }
            )}

            {/* ── Consent checkboxes ─────────────────────────────── */}
            <ThemedView style={styles.consentSection}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => {
                  setTermsAccepted((v) => !v);
                  setConsentError(null);
                }}
                disabled={isLoading}
                activeOpacity={0.8}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: consentError && !termsAccepted ? '#ff4444' : tintColor,
                      backgroundColor: termsAccepted ? tintColor : 'transparent',
                    },
                  ]}>
                  {termsAccepted ? (
                    <ThemedText style={styles.checkmark}>✓</ThemedText>
                  ) : null}
                </View>
                <ThemedText style={styles.checkboxLabel}>
                  I have read and agree to the{' '}
                  <ThemedText
                    style={[styles.link, { color: tintColor }]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onPress={() => router.push('/terms-of-use' as any)}>
                    Terms of Use
                  </ThemedText>
                  {' '}and{' '}
                  <ThemedText
                    style={[styles.link, { color: tintColor }]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onPress={() => router.push('/privacy-policy' as any)}>
                    Privacy Policy
                  </ThemedText>
                  {' '}(required)
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAnalyticsConsent((v) => !v)}
                disabled={isLoading}
                activeOpacity={0.8}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: tintColor,
                      backgroundColor: analyticsConsent ? tintColor : 'transparent',
                    },
                  ]}>
                  {analyticsConsent ? (
                    <ThemedText style={styles.checkmark}>✓</ThemedText>
                  ) : null}
                </View>
                <ThemedText style={styles.checkboxLabel}>
                  I agree to optional anonymous usage analytics to help improve SmartShelf (optional — you can change this later in Settings)
                </ThemedText>
              </TouchableOpacity>

              {consentError ? (
                <ThemedText style={styles.errorText}>{consentError}</ThemedText>
              ) : null}
            </ThemedView>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: buttonBgColor },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}>
              <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>
                {isLoading ? 'Creating account…' : 'Create account'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={handleBackToLogin}
              disabled={isLoading}>
              <ThemedText style={styles.backToLoginText}>
                Already have an account?{' '}
                <ThemedText style={[styles.backToLoginText, { fontWeight: '600', opacity: 1 }]}>
                  Sign in
                </ThemedText>
              </ThemedText>
            </TouchableOpacity>

            <View style={styles.portalAccessRow}>
              <TouchableOpacity
                onPress={() => router.push('/register-parent' as never)}
                disabled={isLoading}
                activeOpacity={0.8}>
                <ThemedText style={[styles.portalAccessLink, { color: tintColor }]}>
                  Parent Access
                </ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.portalAccessDivider}>·</ThemedText>
              <TouchableOpacity
                onPress={() => router.push('/teacher-sign-in' as never)}
                disabled={isLoading}
                activeOpacity={0.8}>
                <ThemedText style={[styles.portalAccessLink, { color: tintColor }]}>
                  Teacher Access
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </ThemedView>
      </ScrollView>

      <Modal visible={orgPickerOpen} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setOrgPickerOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Select your school
            </ThemedText>
            <FlatList
              data={organizations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.orgRow,
                    { borderBottomColor: iconColor },
                    item.slug === selectedOrgSlug && {
                      backgroundColor: isDark ? 'rgba(0,255,65,0.12)' : 'rgba(0,255,65,0.1)',
                    },
                  ]}
                  onPress={() => {
                    setSelectedOrgSlug(item.slug);
                    setErrors((e) => (e.organization ? { ...e, organization: null } : e));
                    setOrgPickerOpen(false);
                  }}>
                  <ThemedText style={styles.orgName}>{item.name}</ThemedText>
                  {item.address ? (
                    <ThemedText style={[styles.orgMeta, { color: iconColor }]} numberOfLines={2}>
                      {item.address}
                    </ThemedText>
                  ) : null}
                </TouchableOpacity>
              )}
              style={styles.orgList}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setOrgPickerOpen(false)}>
              <ThemedText style={{ color: tintColor, fontWeight: '600' }}>Cancel</ThemedText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
    width: '100%',
  },
  titleContainer: {
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  bannerError: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.35)',
  },
  bannerErrorText: {
    color: '#ff4444',
    fontSize: 14,
  },
  form: {
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    width: '100%',
  },
  pickerShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleChipsRow: {
    gap: 10,
    paddingVertical: 4,
  },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  roleChipLabel: {
    fontSize: 14,
  },
  inputError: {
    borderColor: '#ff4444',
    borderWidth: 1,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backToLoginButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  portalAccessRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingVertical: 8,
  },
  portalAccessLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  portalAccessDivider: {
    fontSize: 16,
    opacity: 0.4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '72%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  modalTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  orgList: {
    maxHeight: 360,
  },
  orgRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
  },
  orgMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  consentSection: {
    gap: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    lineHeight: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.85,
  },
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  parentalNoticeBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4a017',
    backgroundColor: 'rgba(212,160,23,0.08)',
    padding: 14,
    gap: 8,
  },
  parentalNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b38600',
  },
  parentalNoticeBody: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.85,
  },
});
