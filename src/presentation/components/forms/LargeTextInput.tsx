import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { controlSize, palette, radius, spacing, typography } from '@/core/theme';

type LargeTextInputProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function LargeTextInput({
  label,
  error,
  hint,
  style,
  ...props
}: LargeTextInputProps) {
  const hasError = Boolean(error);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        aria-invalid={hasError}
        placeholderTextColor={palette.textMuted}
        selectionColor={palette.primary}
        style={[styles.input, hasError && styles.inputError, style]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  input: {
    minHeight: controlSize.minHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    color: palette.text,
    fontSize: typography.body,
  },
  inputError: {
    borderColor: palette.danger,
  },
  hint: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  error: {
    color: palette.danger,
    fontSize: typography.caption,
    fontWeight: '700',
  },
});
