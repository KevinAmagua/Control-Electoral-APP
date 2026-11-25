import { Stack } from 'expo-router';

export default function RecintoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="nueva-mesa" options={{ presentation: 'modal' }} />
      <Stack.Screen name="nuevo-veedor" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
