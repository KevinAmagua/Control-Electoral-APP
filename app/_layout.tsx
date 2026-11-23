import * as Sentry from '@sentry/react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { palette } from '@/core/theme';
import { initializeSentry, setSentryScreen } from '@/data/monitoring/sentry';
import { SessionProvider, useSession } from '@/presentation/session/SessionProvider';
import { AppThemeProvider } from '@/presentation/theme';

initializeSentry();

function RootNavigator() {
  const { status, role, mustChangePassword, isLoading } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    setSentryScreen(pathname);
  }, [pathname]);
  const isAuthenticated = status === 'authenticated' && role !== null;
  const needsPasswordChange = isAuthenticated && mustChangePassword;
  const isReady = isAuthenticated && !mustChangePassword;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={status === 'guest' || needsPasswordChange}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={isReady && role === 'coordinador_provincial'}>
        <Stack.Screen name="(provincial)" />
      </Stack.Protected>

      <Stack.Protected guard={isReady && role === 'coordinador_recinto'}>
        <Stack.Screen name="(recinto)" />
      </Stack.Protected>

      <Stack.Protected guard={isReady && role === 'veedor'}>
        <Stack.Screen name="(veedor)" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  return (
    <SessionProvider>
      <AppThemeProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </AppThemeProvider>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
});

export default Sentry.wrap(RootLayout);
