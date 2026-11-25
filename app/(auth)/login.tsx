import { zodResolver } from '@hookform/resolvers/zod';
import LottieView from 'lottie-react-native';
import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { palette, radius, spacing, typography } from '@/core/theme';
import { loginSchema } from '@/domain/validation/auth';
import { getHomeRoute } from '@/presentation/navigation/role-routes';
import { useSession } from '@/presentation/session/SessionProvider';
import {
  LargeTextInput,
  PrimaryButton,
  StatusFeedback,
} from '@/presentation/components';

type LoginValues = z.input<typeof loginSchema>;
type LoginResult = z.output<typeof loginSchema>;

export default function LoginScreen() {
  const { status, role, mustChangePassword, emailVerified, signIn, resendConfirmation } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const heroProgress = useSharedValue(0);
  const formProgress = useSharedValue(0);
  const {
    control,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues, unknown, LoginResult>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    heroProgress.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    formProgress.value = withDelay(
      120,
      withTiming(1, {
        duration: 560,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [formProgress, heroProgress]);

  useEffect(() => {
    if (status === 'authenticated' && role && !mustChangePassword) {
      router.replace(getHomeRoute({ status, role, mustChangePassword, emailVerified }));
    }
  }, [status, role, mustChangePassword, emailVerified]);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroProgress.value,
    transform: [{ translateY: 18 * (1 - heroProgress.value) }],
  }));
  const formAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formProgress.value,
    transform: [
      { translateY: 22 * (1 - formProgress.value) },
      { scale: 0.98 + 0.02 * formProgress.value },
    ],
  }));

  const onSubmit = async (values: LoginResult) => {
    setServerError(null);
    setNeedsVerification(false);
    setConfirmationSent(false);

    const result = await signIn(values.email, values.password);
    if (!result.ok) {
      setServerError(result.error.message);
      setNeedsVerification(result.error.code === 'CORREO_NO_VERIFICADO');
      return;
    }

    router.replace(getHomeRoute(result.value));
  };

  const handleResend = async () => {
    if (isResending) {
      return;
    }
    const valid = await trigger('email');
    if (!valid) {
      return;
    }

    setIsResending(true);
    const result = await resendConfirmation(getValues('email').trim().toLowerCase());
    setIsResending(false);

    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }

    setServerError(null);
    setConfirmationSent(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.hero, heroAnimatedStyle]}>
            <View style={styles.brandRow}>
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>Control Electoral ADN</Text>
                <View style={styles.accessBadge}>
                  <View style={styles.accessDot} />
                  <Text style={styles.accessLabel}>ACCESO INSTITUCIONAL</Text>
                </View>
              </View>
              <View style={styles.brandMark}>
                <LottieView
                  source={require('@/assets/animations/login-orbit.json')}
                  autoPlay
                  loop
                  style={styles.brandOrbit}
                />
                <SymbolView
                  name={{
                    ios: 'checkmark.seal.fill',
                    android: 'verified',
                    web: 'verified',
                  }}
                  size={28}
                  tintColor={palette.primary}
                  style={styles.brandIcon}
                />
              </View>
            </View>

            <View style={styles.welcome}>
              <View style={styles.accentLine} />
              <Text style={styles.welcomeTitle}>Bienvenido</Text>
              <Text style={styles.welcomeSubtitle}>
                Ingresa con tu correo institucional para acceder a Control Electoral ADN.
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.formCard, formAnimatedStyle]}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Iniciar sesión</Text>
              <Text style={styles.formSubtitle}>Completa tus datos para continuar.</Text>
            </View>

            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <LargeTextInput
                    label="Correo electrónico"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="nombre@organizacion.gob.ec"
                    error={errors.email?.message ?? null}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <LargeTextInput
                    label="Contraseña"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    secureTextEntry
                    showPasswordToggle
                    autoCapitalize="none"
                    placeholder="Ingresa tu contraseña"
                    error={errors.password?.message ?? null}
                  />
                )}
              />
            </View>

            {serverError ? <StatusFeedback status="fallado" message={serverError} /> : null}
            {confirmationSent ? (
              <StatusFeedback
                status="guardado"
                message="Revise su correo para confirmar la cuenta"
              />
            ) : null}

            <Link href="/recuperar-clave" style={styles.recoveryLink}>
              Olvidé mi contraseña
            </Link>

            {needsVerification ? (
              <PrimaryButton
                label="Reenviar confirmación"
                onPress={() => void handleResend()}
                isLoading={isResending}
                disabled={isResending}
                tone="secondary"
              />
            ) : null}

            <PrimaryButton
              label="Ingresar"
              onPress={handleSubmit(onSubmit, () => setServerError(null))}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            />

            <View style={styles.confirmationPrompt}>
              <Text style={styles.promptText}>¿Aún no has confirmado tu correo?</Text>
              <Link href="/confirmar-correo" style={styles.confirmationLink}>
                Reenviar confirmación
              </Link>
            </View>
          </Animated.View>

          <Text style={styles.footer}>Control Electoral ADN · Acceso seguro</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.md,
  },
  brandRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  brandName: {
    color: palette.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  accessBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.primaryDark,
  },
  accessDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.primary,
  },
  accessLabel: {
    color: palette.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  brandMark: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  brandOrbit: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 64,
    height: 64,
  },
  brandIcon: {
    width: 28,
    height: 28,
  },
  welcome: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  accentLine: {
    width: 32,
    height: 3,
    marginBottom: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
  },
  welcomeTitle: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
  },
  welcomeSubtitle: {
    maxWidth: 320,
    color: palette.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  formCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  formHeader: {
    gap: spacing.xs,
  },
  formTitle: {
    color: palette.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  formSubtitle: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  form: {
    gap: spacing.md,
  },
  recoveryLink: {
    alignSelf: 'flex-start',
    color: palette.accent,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  confirmationPrompt: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  promptText: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  confirmationLink: {
    color: palette.accent,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  footer: {
    color: palette.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
