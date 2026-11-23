import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { palette, spacing, typography } from '@/core/theme';
import { passwordResetSchema } from '@/domain/validation/auth';
import { LargeTextInput, PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import type { FeedbackStatus } from '@/presentation/components/feedback/StatusFeedback';
import { getHomeRoute } from '@/presentation/navigation/role-routes';
import { useSession } from '@/presentation/session/SessionProvider';

type ResetValues = z.input<typeof passwordResetSchema>;
type ResetResult = z.output<typeof passwordResetSchema>;
type Feedback = { status: FeedbackStatus; message: string } | null;

export default function RestablecerClaveScreen() {
  const { status, role, mustChangePassword, emailVerified, resetPassword } = useSession();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const { control, handleSubmit, trigger, formState: { errors, isSubmitting } } = useForm<
    ResetValues,
    unknown,
    ResetResult
  >({
    resolver: zodResolver(passwordResetSchema),
    mode: 'onChange',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const newPassword = useWatch({ control, name: 'newPassword' });

  useEffect(() => {
    if (newPassword) {
      void trigger('confirmPassword');
    }
  }, [newPassword, trigger]);

  useEffect(() => {
    if (status === 'authenticated' && !mustChangePassword) {
      router.replace(getHomeRoute({ status, role, mustChangePassword, emailVerified }));
    }
  }, [status, role, mustChangePassword, emailVerified]);

  const onSubmit = async (values: ResetResult) => {
    setFeedback({ status: 'en_proceso', message: 'Guardando contraseña...' });
    const result = await resetPassword(values.newPassword);
    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }

    setFeedback({ status: 'guardado', message: 'Contraseña actualizada correctamente' });
    router.replace(getHomeRoute(result.value));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <Screen title="Establecer contraseña" subtitle="Defina su contraseña definitiva">
        <View style={styles.form}>
          {status === 'guest' ? (
            <StatusFeedback
              status="validacion"
              message="Abra el enlace enviado a su correo o solicite uno nuevo"
            />
          ) : null}
          <Controller
            control={control}
            name="newPassword"
            render={({ field }) => (
              <LargeTextInput
                label="Nueva contraseña"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry
                autoCapitalize="none"
                error={errors.newPassword?.message ?? null}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field }) => (
              <LargeTextInput
                label="Confirmar contraseña"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry
                autoCapitalize="none"
                error={errors.confirmPassword?.message ?? null}
              />
            )}
          />
          {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
          <PrimaryButton
            label="Guardar contraseña"
            onPress={handleSubmit(onSubmit, () => setFeedback(null))}
            isLoading={isSubmitting}
            disabled={isSubmitting || status !== 'authenticated'}
          />
          <Link href="/recuperar-clave" style={styles.link}>
            Solicitar un nuevo enlace
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  form: {
    gap: spacing.lg,
  },
  link: {
    color: palette.accent,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
});
