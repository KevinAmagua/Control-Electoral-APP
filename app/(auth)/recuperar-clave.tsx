import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { StyleSheet, View } from 'react-native';

import { palette, spacing, typography } from '@/core/theme';
import { recoverySchema } from '@/domain/validation/auth';
import { LargeTextInput, PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import type { FeedbackStatus } from '@/presentation/components/feedback/StatusFeedback';
import { useSession } from '@/presentation/session/SessionProvider';

type RecoveryValues = z.input<typeof recoverySchema>;
type RecoveryResult = z.output<typeof recoverySchema>;
type Feedback = { status: FeedbackStatus; message: string } | null;

export default function RecuperarClaveScreen() {
  const { email, requestPasswordRecovery } = useSession();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<
    RecoveryValues,
    unknown,
    RecoveryResult
  >({
    resolver: zodResolver(recoverySchema),
    mode: 'onChange',
    defaultValues: { email: email ?? '' },
  });

  const onSubmit = async (values: RecoveryResult) => {
    const result = await requestPasswordRecovery(values.email);
    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }

    setFeedback({
      status: 'guardado',
      message: 'Si la cuenta existe, enviaremos un enlace para restablecer la contraseña',
    });
  };

  return (
    <Screen title="Recuperar contraseña" subtitle="Enviaremos un enlace seguro a su correo">
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
          label="Enviar enlace"
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
