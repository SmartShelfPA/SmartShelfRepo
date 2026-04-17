import { useEffect, useState, useRef } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { setToken } from '@/services/api';

type FieldName = 'name' | 'email' | 'password';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<FieldName, string | null>>({
    name: null,
    email: null,
    password: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Ref to track current field values to avoid stale state in onBlur
  const currentValuesRef = useRef(formData);

  useEffect(() => {
    currentValuesRef.current = formData;
  }, [formData]);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  
  // Use consistent button colors matching homepage
  const buttonBgColor = '#00FF41'; // UFO Green - matches homepage
  const buttonTextColor = '#FFFFFF'; // White text on green button

  const validateField = (fieldName: FieldName, value: string): string | null => {
    switch (fieldName) {
      case 'name':
        if (!value.trim()) {
          return 'Name is required';
        }
        return null;

      case 'email':
        if (!value.trim()) {
          return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
        return null;

      case 'password':
        if (!value) {
          return 'Password is required';
        }
        if (value.length < 8) {
          return 'Password must be at least 8 characters long';
        }
        if (!/[A-Z]/.test(value)) {
          return 'Password must contain at least one uppercase letter';
        }
        if (!/[a-z]/.test(value)) {
          return 'Password must contain at least one lowercase letter';
        }
        if (!/[0-9]/.test(value)) {
          return 'Password must contain at least one number';
        }
        if (!/[^a-zA-Z0-9]/.test(value)) {
          return 'Password must contain at least one special character';
        }
        return null;

      default:
        return null;
    }
  };

  const handleFieldChange = (fieldName: FieldName, value: string) => {
    const updatedData = { ...formData, [fieldName]: value };
    setFormData(updatedData);
    // Update ref immediately to ensure latest value is available for onBlur
    currentValuesRef.current = updatedData;
    // Clear error when user starts typing
    setErrors((prevErrors) =>
      prevErrors[fieldName] ? { ...prevErrors, [fieldName]: null } : prevErrors
    );
  };

  const handleFieldBlur = (fieldName: FieldName) => {
    // Use ref value to ensure we validate against the latest input value
    const currentValue = currentValuesRef.current[fieldName];
    const error = validateField(fieldName, currentValue);
    setErrors((prevErrors) => ({ ...prevErrors, [fieldName]: error }));
  };

  const handleSubmit = async () => {
    // Validate all fields
    const newErrors: Record<FieldName, string | null> = {
      name: validateField('name', formData.name),
      email: validateField('email', formData.email),
      password: validateField('password', formData.password),
    };

    setErrors(newErrors);

    // Check if there are any errors
    const hasErrors = Object.values(newErrors).some(error => error !== null);
    if (hasErrors) {
      return;
    }

    setIsLoading(true);

    try {
      await setToken('local-auth-bypass');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('[Register] Failed to store auth:', error);
      router.replace('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Reset form and navigate directly to login
    setFormData({
      name: '',
      email: '',
      password: '',
    });
    setErrors({
      name: null,
      email: null,
      password: null,
    });
    router.push('/login');
  };

  const renderField = (
    fieldName: FieldName,
    label: string,
    placeholder: string,
    helperText?: string,
    options?: {
      keyboardType?: 'default' | 'email-address' | 'numeric';
      autoCapitalize?: 'none' | 'words' | 'sentences';
      secureTextEntry?: boolean;
      maxLength?: number;
    }
  ) => {
    return (
      <ThemedView style={styles.inputContainer} key={fieldName}>
        <ThemedText style={styles.label}>{label}</ThemedText>
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
          secureTextEntry={options?.secureTextEntry || false}
          maxLength={options?.maxLength}
        />
        {errors[fieldName] && (
          <ThemedText style={styles.errorText}>{errors[fieldName]}</ThemedText>
        )}
        {helperText && !errors[fieldName] && (
          <ThemedText style={styles.helperText}>{helperText}</ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 32 }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedView style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title} numberOfLines={2}>
                Create Account
              </ThemedText>
            </ThemedView>
            <ThemedText style={styles.subtitle}>
              Fill in your details to get started
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            {renderField(
              'name',
              'Full Name',
              'Enter your full name',
              undefined,
              { autoCapitalize: 'words' }
            )}

            {renderField(
              'email',
              'School Email',
              'Enter school email',
              undefined,
              { keyboardType: 'email-address' }
            )}

            {renderField(
              'password',
              'Password',
              'Enter your password',
              'Must be 8+ characters with uppercase, lowercase, number, and special character',
              { secureTextEntry: true }
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
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={handleBackToLogin}
              disabled={isLoading}>
              <ThemedText style={styles.backToLoginText}>
                Already have an account? <ThemedText style={[styles.backToLoginText, { fontWeight: '600', opacity: 1 }]}>Sign In</ThemedText>
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
    marginBottom: 32,
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
});

