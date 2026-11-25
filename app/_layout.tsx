import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { palette } from '@/core/theme';
import { initializeSentry, setSentryScreen } from '@/data/monitoring/sentry';
import { AppErrorBoundary } from '@/presentation/components';
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

      <Stack.Screen name="(auth)" />

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
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <AppErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <RootNavigator />
            <StatusBar style="light" />
          </AppThemeProvider>
        </QueryClientProvider>
      </SessionProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

export default Sentry.wrap(RootLayout);
