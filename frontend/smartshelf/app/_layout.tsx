import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthBootstrap } from '@/src/components/AuthBootstrap';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { installGlobalErrorHandlers } from '@/src/lib/errorReporter';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthBootstrap>
        <Stack initialRouteName="index">
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="account-select" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="register-parent" options={{ headerShown: false }} />
          <Stack.Screen name="parent-sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="teacher-sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="parent" options={{ headerShown: false }} />
          <Stack.Screen name="teacher" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="book/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="subject-textbooks" options={{ headerShown: false }} />
          <Stack.Screen name="shelf/[shelfId]" options={{ headerShown: false }} />
          <Stack.Screen name="igcse" options={{ headerShown: false }} />
          <Stack.Screen name="practice" options={{ headerShown: false }} />
          <Stack.Screen
            name="pdf-viewer"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen name="downloads" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        </AuthBootstrap>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
