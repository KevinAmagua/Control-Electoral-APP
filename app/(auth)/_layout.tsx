import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="cambiar-clave" />
      <Stack.Screen name="recuperar-clave" />
      <Stack.Screen name="confirmar-correo" />
      <Stack.Screen name="callback" />
      <Stack.Screen name="restablecer-clave" />
    </Stack>
  );
}
