import { DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { palette } from '@/core/theme';

const navigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.primary,
    background: palette.background,
    card: palette.surface,
    text: palette.text,
    border: palette.border,
    notification: palette.accent,
  },
};

export function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <View style={{ flex: 1, backgroundColor: palette.background }}>{children}</View>
    </NavigationThemeProvider>
  );
}
