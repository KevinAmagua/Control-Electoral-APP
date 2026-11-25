import { Stack } from 'expo-router';

export default function VeedorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="registrar-acta" />
    </Stack>
  );
}
