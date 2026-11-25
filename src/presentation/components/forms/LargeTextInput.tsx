import type {
  TextInputBlurEvent,
  TextInputFocusEvent,
  TextInputProps,
  ViewInstance,
} from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { controlSize, palette, radius, spacing, typography } from '@/core/theme';
import { useScreenScrollToField } from '@/presentation/components/layout/Screen';

type LargeTextInputProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  showPasswordToggle?: boolean;
};

export function LargeTextInput({
  label,
  error,
  hint,
  showPasswordToggle = false,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  ...props
}: LargeTextInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fieldRef = useRef<ViewInstance>(null);
  const scrollToField = useScreenScrollToField();
  const hasError = Boolean(error);
  const handleFocus = useCallback(
    (event: TextInputFocusEvent) => {
      setIsFocused(true);
      scrollToField?.(fieldRef.current);
      onFocus?.(event);
    },
    [onFocus, scrollToField],
  );
  const handleBlur = useCallback(
    (event: TextInputBlurEvent) => {
      setIsFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );
  const input = (
    <TextInput
      {...props}
      onFocus={handleFocus}
      onBlur={handleBlur}
      secureTextEntry={showPasswordToggle ? !isPasswordVisible : secureTextEntry}
      accessibilityLabel={props.accessibilityLabel ?? label}
      aria-invalid={hasError}
      placeholderTextColor={palette.textMuted}
      selectionColor={palette.primary}
      style={[
        styles.input,
        showPasswordToggle && styles.passwordTextInput,
        hasError && !showPasswordToggle && styles.inputError,
        !hasError && !showPasswordToggle && isFocused && styles.inputFocused,
        style,
      ]}
    />
  );

  return (
    <View ref={fieldRef} style={styles.wrapper}>
      <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>
      {showPasswordToggle ? (
        <View
          style={[
            styles.passwordInputContainer,
            hasError && styles.inputError,
            !hasError && isFocused && styles.passwordInputFocused,
          ]}>
          {input}
          <PasswordVisibilityButton
            isVisible={isPasswordVisible}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
          />
        </View>
      ) : (
        input
      )}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

function PasswordVisibilityButton({
  isVisible,
  onPress,
}: {
  isVisible: boolean;
  onPress: () => void;
}) {
  const [animationTrigger, setAnimationTrigger] = useState(0);

  const eyeStyle = useAnimatedStyle(() => {
    if (animationTrigger === 0) {
      return { transform: [{ scale: 1 }] };
    }

    return {
      transform: [
        {
          rotate: withSequence(
            withTiming('-12deg', { duration: 70 }),
            withTiming('12deg', { duration: 95 }),
            withSpring('0deg', { damping: 8, stiffness: 240 }),
          ),
        },
        {
          scale: withSequence(
            withSpring(1.34, { damping: 5, stiffness: 320 }),
            withSpring(1, { damping: 9, stiffness: 260 }),
          ),
        },
        {
          scaleY: withSequence(
            withTiming(0.16, { duration: 70 }),
            withSpring(1, { damping: 7, stiffness: 280 }),
          ),
        },
      ],
    };
  });
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: animationTrigger === 0
      ? 0
      : withSequence(
          withTiming(0.4, { duration: 60 }),
          withTiming(0, { duration: 420 }),
        ),
    transform: [{
      scale: animationTrigger === 0
        ? 0.35
        : withSequence(
            withTiming(0.35, { duration: 0 }),
            withTiming(1.8, {
              duration: 420,
              easing: Easing.out(Easing.cubic),
            }),
          ),
    }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      accessibilityState={{ selected: isVisible }}
      hitSlop={8}
      onPress={() => {
        onPress();
        setAnimationTrigger((trigger) => trigger + 1);
      }}
      style={styles.visibilityToggle}>
      <Animated.View pointerEvents="none" style={[styles.visibilityRipple, rippleStyle]} />
      <Animated.View style={[styles.animatedVisibilityIcon, eyeStyle]}>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z"
            fill="none"
            stroke={palette.textMuted}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
          <Circle
            cx={12}
            cy={12}
            r={3}
            fill={isVisible ? palette.primary : 'none'}
            stroke={palette.textMuted}
            strokeWidth={1.8}
          />
          {!isVisible ? (
            <Path
              d="M4 4 20 20"
              fill="none"
              stroke={palette.accent}
              strokeLinecap="round"
              strokeWidth={2}
            />
          ) : null}
        </Svg>
      </Animated.View>
    </Pressable>
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
  labelFocused: {
    color: palette.primaryLight,
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
  inputFocused: {
    borderColor: palette.primary,
    borderWidth: 2,
    backgroundColor: palette.surface,
  },
  passwordInputContainer: {
    minHeight: controlSize.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  passwordInputFocused: {
    borderColor: palette.primary,
    borderWidth: 2,
  },
  passwordTextInput: {
    flex: 1,
    minHeight: controlSize.minHeight - 2,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  visibilityToggle: {
    width: controlSize.minHeight - 2,
    height: controlSize.minHeight - 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  animatedVisibilityIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityRipple: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: palette.accent,
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
