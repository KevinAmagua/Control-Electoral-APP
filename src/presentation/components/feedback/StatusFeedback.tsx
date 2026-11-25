import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette, radius, spacing, typography } from '@/core/theme';
import { ACTA_STATUS_LABELS, type ActaStatus } from '@/domain/acta/acta-status';

export type FeedbackStatus = ActaStatus | 'validacion' | 'guardado_local' | 'enviado';

type StatusFeedbackProps = {
  status: FeedbackStatus;
  message?: string;
};

const animations: Record<FeedbackStatus, AnimationObject> = {
  en_proceso: require('@/assets/animations/loading.json'),
  guardado: require('@/assets/animations/saved.json'),
  guardado_local: require('@/assets/animations/saved.json'),
  enviado: require('@/assets/animations/saved.json'),
  fallado: require('@/assets/animations/failed.json'),
  validacion: require('@/assets/animations/warning.json'),
};

const labels: Record<FeedbackStatus, string> = {
  ...ACTA_STATUS_LABELS,
  validacion: 'Revise los datos',
  guardado_local: 'Guardado localmente · Pendiente',
  enviado: 'Enviado',
};

const tones: Record<FeedbackStatus, string> = {
  en_proceso: palette.primary,
  guardado: palette.success,
  guardado_local: palette.warning,
  enviado: palette.success,
  fallado: palette.danger,
  validacion: palette.warning,
};

export function StatusFeedback({ status, message }: StatusFeedbackProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 650 }), withTiming(1, { duration: 650 })),
      status === 'en_proceso' ? -1 : 1,
      false,
    );

    return () => {
      pulse.value = 1;
    };
  }, [status, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.container, { borderColor: tones[status] }, animatedStyle]}>
      <LottieView
        source={animations[status]}
        style={styles.animation}
        autoPlay
        loop={status === 'en_proceso'}
      />
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: tones[status] }]}>{labels[status]}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    backgroundColor: palette.surface,
  },
  animation: {
    width: 56,
    height: 56,
  },
  textContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  message: {
    color: palette.text,
    fontSize: typography.caption,
  },
});
