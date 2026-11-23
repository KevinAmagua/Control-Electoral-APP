import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { palette, spacing, typography } from '@/core/theme';
import { loginSchema } from '@/domain/validation/auth';
import { getHomeRoute } from '@/presentation/navigation/role-routes';
import { useSession } from '@/presentation/session/SessionProvider';
import {
  LargeTextInput,
  PrimaryButton,
  Screen,
  StatusFeedback,
} from '@/presentation/components';

type LoginValues = z.input<typeof loginSchema>;
type LoginResult = z.output<typeof loginSchema>;

export default function LoginScreen() {
  const { signIn, resendConfirmation } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isResending, setIsResending] = useState(false);
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
    <Screen
      title="Control Electoral ADN"
      subtitle="Ingrese con su correo institucional">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
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
                autoCapitalize="none"
                placeholder="Contraseña"
                error={errors.password?.message ?? null}
              />
            )}
          />

          {serverError ? <StatusFeedback status="fallado" message={serverError} /> : null}
          {confirmationSent ? (
            <StatusFeedback
              status="guardado"
              message="Revise su correo para confirmar la cuenta"
            />
          ) : null}

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

          <View style={styles.links}>
            <Link href="/recuperar-clave" style={styles.link}>
              Olvidé mi contraseña
            </Link>
            <Link href="/confirmar-correo" style={styles.link}>
              Reenviar confirmación
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  form: {
    gap: spacing.lg,
  },
  links: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  link: {
    color: palette.accent,
    fontSize: typography.caption,
    fontWeight: '700',
  },
});
