import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { clearPersistedAuthFromDisk } from '@/services/api';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    router.replace('/login');
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="account-select" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="book/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="subject-textbooks" options={{ headerShown: false }} />
          <Stack.Screen name="in-app-auth-webview" options={{ headerShown: false }} />
          <Stack.Screen name="sample-papers" options={{ headerShown: false }} />
          <Stack.Screen name="parent" options={{ headerShown: false }} />
          <Stack.Screen name="shelf/[shelfId]" options={{ headerShown: false }} />
          <Stack.Screen
            name="pdf-viewer"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
