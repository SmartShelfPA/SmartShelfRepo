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
import { getPortalChoice, type PortalChoice } from '@/src/lib/portalChoice';
import {
  fetchOrganizations,
  type SchoolOrganization,
  type UserRole,
} from '@/services/api';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent / guardian' },
];

type SimpleField = 'name' | 'username' | 'email' | 'password';
type ExtraField = 'dateOfBirth' | 'organization' | 'studentClass' | 'linkedStudentUsername';

type FormErrors = Record<SimpleField | ExtraField, string | null>;

const emptyErrors = (): FormErrors => ({
  name: null,
  username: null,
  email: null,
  password: null,
  dateOfBirth: null,
  organization: null,
  studentClass: null,
  linkedStudentUsername: null,
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

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
  });
  const [role, setRole] = useState<UserRole>('student');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [linkedStudentUsername, setLinkedStudentUsername] = useState('');
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<string | null>(null);

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
    void getPortalChoice().then((portal: PortalChoice | null) => {
      if (portal === 'student' || portal === 'parent') {
        setRole(portal);
      }
    });
  }, []);

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
          setOrgsError(e instanceof Error ? e.message : 'Failed to load schools');
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

    next.dateOfBirth = validateDateOfBirth(dateOfBirth, role === 'student');
    if (role === 'student' && !studentClass.trim()) {
      next.studentClass = 'Class is required for students';
    }
    if (role === 'parent') {
      if (!linkedStudentUsername.trim()) {
        next.linkedStudentUsername = "Student username is required for parent/guardian accounts";
      } else if (!/^[a-zA-Z0-9_]+$/.test(linkedStudentUsername.trim())) {
        next.linkedStudentUsername = 'Only letters, numbers, and underscores allowed';
      }
    }

    if (!selectedOrgSlug) {
      next.organization = 'Select your school or university';
    }

    return next;
  }, [
    formData,
    dateOfBirth,
    role,
    studentClass,
    linkedStudentUsername,
    selectedOrgSlug,
  ]);

  const handleSubmit = async () => {
    const newErrors = validateAll();
    setErrors(newErrors);
    setRegisterError(null);

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
        role,
        date_of_birth: role === 'student' ? dateOfBirth.trim() || null : null,
        student_class: role === 'student' ? studentClass.trim() : undefined,
        linked_student_username:
          role === 'parent' ? linkedStudentUsername.trim() : undefined,
        organization_slug: selectedOrgSlug ?? undefined,
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
    setRole('student');
    setDateOfBirth('');
    setStudentClass('');
    setLinkedStudentUsername('');
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
                Create account
              </ThemedText>
            </ThemedView>
            <ThemedText style={styles.subtitle}>
              Choose your role and school, then complete your details
            </ThemedText>
          </ThemedView>

          {registerError ? (
            <ThemedView style={styles.bannerError}>
              <ThemedText style={styles.bannerErrorText}>{registerError}</ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.form}>
            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>I am a</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roleChipsRow}>
                {ROLE_OPTIONS.map((opt) => {
                  const selected = role === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.roleChip,
                        {
                          borderColor: selected ? tintColor : iconColor,
                          backgroundColor: selected
                            ? isDark
                              ? 'rgba(0,255,65,0.15)'
                              : 'rgba(0,255,65,0.12)'
                            : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        setRole(opt.value);
                        setRegisterError(null);
                        setErrors((prev) => ({
                          ...prev,
                          organization: null,
                          dateOfBirth: null,
                          studentClass: null,
                          linkedStudentUsername: null,
                        }));
                      }}
                      disabled={isLoading}
                      activeOpacity={0.8}>
                      <ThemedText
                        style={[styles.roleChipLabel, selected && { fontWeight: '700' }]}>
                        {opt.label}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ThemedView>

            {renderOrgPicker()}

            {role === 'student' ? (
              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>
                  Date of birth
                </ThemedText>
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
            ) : null}

            {role === 'student' ? (
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
            ) : null}

            {role === 'parent' ? (
              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Student username</ThemedText>
                <ThemedTextInput
                  style={[styles.input, errors.linkedStudentUsername && styles.inputError]}
                  placeholder="Enter your child's username"
                  value={linkedStudentUsername}
                  onChangeText={(t) => {
                    setLinkedStudentUsername(t);
                    setErrors((e) =>
                      e.linkedStudentUsername ? { ...e, linkedStudentUsername: null } : e
                    );
                    setRegisterError(null);
                  }}
                  editable={!isLoading}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.linkedStudentUsername ? (
                  <ThemedText style={styles.errorText}>{errors.linkedStudentUsername}</ThemedText>
                ) : (
                  <ThemedText style={styles.helperText}>
                    Required: enter your child's student username
                  </ThemedText>
                )}
              </ThemedView>
            ) : null}

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
});
