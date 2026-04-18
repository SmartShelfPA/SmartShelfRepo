import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '../store/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Reuse existing tab screens during migration (wrapped in /src/screens)
import HomeScreen from '../screens/public/HomeScreen';
import BookshelfScreen from '../screens/protected/BookshelfScreen';
import ProfileScreen from '../screens/protected/ProfileScreen';
import InAppAuthWebView from '../screens/InAppAuthWebView';

export type RootStackParamList = {
  MainTabs: undefined;
  PDFReader: { bookId: string };
  InAppAuthWebView: { url?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Bookshelf"
        component={BookshelfScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="menu-book" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const loading = useAuthStore((s) => s.isHydrating);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="InAppAuthWebView"
        component={InAppAuthWebView}
        options={{ title: 'Sign In' }}
      />
      {/* PDFReader and auth-protected routes can be added here as you migrate */}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const colorScheme = useColorScheme();
  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}



