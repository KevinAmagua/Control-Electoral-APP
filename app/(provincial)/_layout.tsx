import { Stack } from 'expo-router';

export default function ProvincialLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="revision-actas" />
      <Stack.Screen name="gestion-recintos" />
    </Stack>
  );
}
