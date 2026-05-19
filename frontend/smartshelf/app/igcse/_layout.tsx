import { Stack } from 'expo-router';

export default function IgcsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="books/index" />
      <Stack.Screen name="revision/index" />
      <Stack.Screen name="revision/[subject]/index" />
      <Stack.Screen name="revision/[subject]/[chapter]" />
      <Stack.Screen name="revision/session" />
      <Stack.Screen name="search/index" />
      <Stack.Screen name="simulator" />
      <Stack.Screen name="book/[id]" />
      <Stack.Screen name="reader/[id]" />
    </Stack>
  );
}
