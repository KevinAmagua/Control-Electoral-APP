import { Stack } from 'expo-router';

export default function VeedorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="mesas" />
      <Stack.Screen name="registrar-acta" />
      <Stack.Screen name="estados-acta" />
    </Stack>
  );
}
