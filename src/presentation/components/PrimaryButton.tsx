import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { controlSize, palette, radius, spacing, typography } from '@/core/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'accent' | 'secondary';
  compact?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  tone = 'primary',
  compact = false,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || isLoading;
  const isSecondary = tone === 'secondary';
  const backgroundColor =
    tone === 'accent'
      ? palette.accent
      : isSecondary
        ? palette.surface
        : palette.primary;
  const borderColor =
    tone === 'accent'
      ? palette.accentDark
      : isSecondary
        ? palette.border
        : palette.primaryDark;
  const foregroundColor =
    tone === 'accent'
      ? palette.onAccent
      : isSecondary
        ? palette.text
        : palette.onPrimary;

  useEffect(() => {
    scale.value = withTiming(pressed && !isDisabled ? 0.98 : 1, {
      duration: pressed ? 80 : 120,
    });
  }, [pressed, isDisabled, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: isLoading }}
        disabled={isDisabled}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={onPress}
        style={({ pressed }) => [
          compact ? styles.compactButton : styles.button,
          { backgroundColor, borderColor },
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
        ]}>
        <View style={compact ? styles.compactContent : styles.content}>
          {isLoading ? (
            <ActivityIndicator color={foregroundColor} size="small" />
          ) : (
            <Text
              style={[
                compact ? styles.compactLabel : styles.label,
                { color: foregroundColor },
              ]}>
              {label}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: controlSize.minHeight,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
  },
  compactButton: {
    minHeight: controlSize.compactHeight,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
  },
  content: {
    minHeight: typography.body + spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  compactLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
});
