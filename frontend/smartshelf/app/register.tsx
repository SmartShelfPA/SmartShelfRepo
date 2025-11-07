import { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { register } from '@/services/api';

// Configurable minimum age
const MINIMUM_AGE = 13;

type RegistrationStep = 'name' | 'email' | 'dateOfBirth' | 'username' | 'password';

const STEP_ORDER: RegistrationStep[] = ['name', 'email', 'dateOfBirth', 'username', 'password'];

const STEP_LABELS: Record<RegistrationStep, string> = {
  name: 'Full Name',
  email: 'Email Address',
  dateOfBirth: 'Date of Birth',
  username: 'Username',
  password: 'Password',
};

export default function RegisterScreen() {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('name');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    dateOfBirth: '',
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const colorScheme = useColorScheme();
  const buttonTextColor = colorScheme === 'dark' ? Colors.dark.text : '#fff';

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;

  const validateField = (step: RegistrationStep, value: string): string | null => {
    switch (step) {
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

      case 'dateOfBirth':
        if (!value.trim()) {
          return 'Date of birth is required';
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          return 'Please enter date in YYYY-MM-DD format';
        }
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();
        const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        
        if (actualAge < MINIMUM_AGE) {
          return `You must be at least ${MINIMUM_AGE} years old to register`;
        }
        if (birthDate > today) {
          return 'Date of birth cannot be in the future';
        }
        return null;

      case 'username':
        if (!value.trim()) {
          return 'Username is required';
        }
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(value)) {
          return 'Username can only contain letters, numbers, and underscores';
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

  const handleNext = () => {
    const currentValue = formData[currentStep];
    const error = validateField(currentStep, currentValue);

    if (error) {
      // Validation error - just return without showing alert
      return;
    }

    if (isLastStep) {
      handleSubmit();
    } else {
      const nextStep = STEP_ORDER[currentStepIndex + 1];
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      const prevStep = STEP_ORDER[currentStepIndex - 1];
      setCurrentStep(prevStep);
    }
  };

  const handleSubmit = async () => {
    // Validate all fields one more time
    for (const step of STEP_ORDER) {
      const error = validateField(step, formData[step]);
      if (error) {
        // Validation error - go to the step with error
        setCurrentStep(step);
        return;
      }
    }

    setIsLoading(true);

    try {
      const response = await register(
        formData.name,
        formData.username,
        formData.password,
        formData.email,
        formData.dateOfBirth
      );
      
      // Check if token was successfully stored
      if (response && response.token) {
        // Registration successful and token stored - navigate directly to tabs (home)
        router.replace('/(tabs)');
      } else {
        // Token not received - redirect to login instead
        console.error('[Register] Token not received in response');
        router.replace('/login');
      }
    } catch (error: any) {
      // Registration failed - stay on current step
      // Error is logged in the API service
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Reset form and navigate directly to login
    setFormData({
      name: '',
      email: '',
      dateOfBirth: '',
      username: '',
      password: '',
    });
    setCurrentStep('name');
    router.push('/login');
  };

  const getInputProps = () => {
    switch (currentStep) {
      case 'name':
        return {
          placeholder: 'Enter your full name',
          value: formData.name,
          onChangeText: (text: string) => setFormData({ ...formData, name: text }),
          autoCapitalize: 'words' as const,
          autoCorrect: false,
        };

      case 'email':
        return {
          placeholder: 'Enter your email address',
          value: formData.email,
          onChangeText: (text: string) => setFormData({ ...formData, email: text }),
          keyboardType: 'email-address' as const,
          autoCapitalize: 'none' as const,
          autoCorrect: false,
        };

      case 'dateOfBirth':
        return {
          placeholder: 'YYYY-MM-DD',
          value: formData.dateOfBirth,
          onChangeText: (text: string) => setFormData({ ...formData, dateOfBirth: text }),
          keyboardType: 'numeric' as const,
          maxLength: 10,
        };

      case 'username':
        return {
          placeholder: 'Enter your username',
          value: formData.username,
          onChangeText: (text: string) => setFormData({ ...formData, username: text }),
          autoCapitalize: 'none' as const,
          autoCorrect: false,
        };

      case 'password':
        return {
          placeholder: 'Enter your password',
          value: formData.password,
          onChangeText: (text: string) => setFormData({ ...formData, password: text }),
          secureTextEntry: true,
          autoCapitalize: 'none' as const,
          autoCorrect: false,
        };

      default:
        return {};
    }
  };

  const getFieldHelperText = (): string | null => {
    switch (currentStep) {
      case 'email':
        return 'We\'ll use this to send you important updates';
      case 'dateOfBirth':
        return `You must be at least ${MINIMUM_AGE} years old`;
      case 'username':
        return 'Only letters, numbers, and underscores allowed';
      case 'password':
        return 'Must be 8+ characters with uppercase, lowercase, number, and special character';
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Create Account
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Step {currentStepIndex + 1} of {STEP_ORDER.length}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>
                {STEP_LABELS[currentStep]}
              </ThemedText>
              <ThemedTextInput
                style={styles.input}
                {...getInputProps()}
                editable={!isLoading}
              />
              {getFieldHelperText() && (
                <ThemedText style={styles.helperText}>
                  {getFieldHelperText()}
                </ThemedText>
              )}
            </ThemedView>

            <ThemedView style={styles.buttonContainer}>
              {!isFirstStep && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary, { borderColor: tintColor }]}
                  onPress={handleBack}
                  disabled={isLoading}
                  activeOpacity={0.8}>
                  <ThemedText style={[styles.buttonText, { color: tintColor }]}>
                    Back
                  </ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.buttonPrimary,
                  { backgroundColor: tintColor },
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleNext}
                disabled={isLoading}
                activeOpacity={0.8}>
                <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
                  {isLoading
                    ? 'Processing...'
                    : isLastStep
                    ? 'Register'
                    : 'Next'}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>

            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={handleBackToLogin}
              disabled={isLoading}>
              <ThemedText style={styles.backToLoginText}>
                Back to Login
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
  helperText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    // backgroundColor set dynamically
  },
  buttonSecondary: {
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backToLoginButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 14,
    opacity: 0.7,
  },
});

