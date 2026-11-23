import { Stack } from 'expo-router';

export default function RecintoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="recinto" />
      <Stack.Screen name="asignar-veedores" />
      <Stack.Screen name="conflictos" />
      <Stack.Screen name="revision-acta" />
      <Stack.Screen name="nuevo-veedor" />
    </Stack>
  );
}
