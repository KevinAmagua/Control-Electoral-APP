import { DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { palette } from '@/core/theme';

const navigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.primary,
    background: 'transparent',
    card: palette.surface,
    text: palette.text,
    border: palette.border,
    notification: palette.accent,
  },
};

export function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <View style={styles.root}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient
                id="app-background-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%">
                <Stop offset="0%" stopColor={palette.primaryDark} stopOpacity={0.9} />
                <Stop offset="48%" stopColor={palette.background} stopOpacity={1} />
                <Stop offset="100%" stopColor={palette.primaryLight} stopOpacity={0.82} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#app-background-gradient)" />
          </Svg>
        </View>
        {children}
      </View>
    </NavigationThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
});
