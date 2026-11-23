import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { StyleSheet, View } from 'react-native';

import { palette, spacing, typography } from '@/core/theme';
import { confirmEmailSchema } from '@/domain/validation/auth';
import { LargeTextInput, PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import type { FeedbackStatus } from '@/presentation/components/feedback/StatusFeedback';
import { useSession } from '@/presentation/session/SessionProvider';

type ConfirmEmailValues = z.input<typeof confirmEmailSchema>;
type ConfirmEmailResult = z.output<typeof confirmEmailSchema>;
type Feedback = { status: FeedbackStatus; message: string } | null;

export default function ConfirmarCorreoScreen() {
  const { email, resendConfirmation } = useSession();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<
    ConfirmEmailValues,
    unknown,
    ConfirmEmailResult
  >({
    resolver: zodResolver(confirmEmailSchema),
    mode: 'onChange',
    defaultValues: { email: email ?? '' },
  });

  const onSubmit = async (values: ConfirmEmailResult) => {
    const result = await resendConfirmation(values.email);
    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }

    setFeedback({
      status: 'guardado',
      message: 'Enviamos un nuevo enlace de confirmación a su correo',
    });
  };

  return (
    <Screen title="Confirmar correo" subtitle="Reenvíe el enlace de verificación si no lo recibió">
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
        {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
        <PrimaryButton
          label="Reenviar confirmación"
          onPress={handleSubmit(onSubmit, () => setFeedback(null))}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        />
        <Link href="/login" style={styles.link}>
          Volver al inicio de sesión
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
