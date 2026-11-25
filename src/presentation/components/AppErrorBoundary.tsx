import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { captureError } from '@/data/monitoring/sentry';

import { PrimaryButton } from './PrimaryButton';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, {
      scope: 'app.errorBoundary',
      componentStack: info.componentStack ?? null,
    });
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>La app encontró un problema</Text>
        <Text style={styles.message}>
          El incidente fue registrado. Puede intentar continuar; sus actas guardadas localmente se
          conservan.
        </Text>
        <PrimaryButton
          label="Reintentar"
          tone="secondary"
          onPress={() => this.setState({ hasError: false })}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: palette.background,
  },
  title: {
    color: palette.text,
    fontSize: typography.heading,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: palette.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing.sm,
  },
  card: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
});
