import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { palette, spacing, typography } from '@/core/theme';
import { passwordChangeSchema } from '@/domain/validation/auth';
import { LargeTextInput, PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import type { FeedbackStatus } from '@/presentation/components/feedback/StatusFeedback';
import { getHomeRoute } from '@/presentation/navigation/role-routes';
import { useSession } from '@/presentation/session/SessionProvider';

type ChangePasswordValues = z.input<typeof passwordChangeSchema>;
type ChangePasswordResult = z.output<typeof passwordChangeSchema>;
type Feedback = { status: FeedbackStatus; message: string } | null;

export default function CambiarClaveScreen() {
  const {
    role,
    status,
    mustChangePassword,
    emailVerified,
    changePassword,
    signOut,
  } = useSession();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const { control, handleSubmit, trigger, formState: { errors, isSubmitting } } = useForm<
    ChangePasswordValues,
    unknown,
    ChangePasswordResult
  >({
    resolver: zodResolver(passwordChangeSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const currentPassword = useWatch({ control, name: 'currentPassword' });
  const newPassword = useWatch({ control, name: 'newPassword' });

  useEffect(() => {
    if (newPassword) {
      void trigger('confirmPassword');
    }
  }, [newPassword, trigger]);

  useEffect(() => {
    if (currentPassword && newPassword) {
      void trigger('newPassword');
    }
  }, [currentPassword, newPassword, trigger]);

  useEffect(() => {
    if (status === 'authenticated' && !mustChangePassword) {
      router.replace(
        getHomeRoute({
          status,
          role,
          mustChangePassword,
          emailVerified,
        }),
      );
    }
  }, [status, role, mustChangePassword, emailVerified]);

  const onSubmit = async (values: ChangePasswordResult) => {
    setFeedback({ status: 'en_proceso', message: 'Actualizando contraseña...' });
    const result = await changePassword(values.currentPassword, values.newPassword);
    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }

    setFeedback({
      status: 'guardado',
      message: 'Contraseña actualizada correctamente.',
    });
    router.replace(getHomeRoute(result.value));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <Screen
        title="Cambiar contraseña"
        subtitle="Actualice su clave antes de continuar">
        {status === 'guest' ? (
          <StatusFeedback
            status="validacion"
            message="Inicie sesión para cambiar su contraseña."
          />
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Requisitos de la contraseña</Text>
          <Text style={styles.infoText}>Mínimo 8 caracteres, letras y números.</Text>
          <Text style={styles.infoText}>No comparta su clave con otras personas.</Text>
        </View>

        <Controller
          control={control}
          name="currentPassword"
          render={({ field }) => (
            <LargeTextInput
              label="Contraseña actual"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoCapitalize="none"
              error={errors.currentPassword?.message ?? null}
            />
          )}
        />
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
              label="Confirmar nueva contraseña"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoCapitalize="none"
              error={errors.confirmPassword?.message ?? null}
            />
          )}
        />

        {feedback ? (
          <StatusFeedback status={feedback.status} message={feedback.message} />
        ) : null}

        <PrimaryButton
          label="Guardar contraseña"
          onPress={handleSubmit(onSubmit, () => setFeedback(null))}
          isLoading={isSubmitting}
          disabled={isSubmitting || status !== 'authenticated'}
        />
        <PrimaryButton
          label="Cerrar sesión"
          onPress={() => void signOut()}
          tone="secondary"
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  infoCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: palette.accentDark,
    backgroundColor: palette.surface,
  },
  infoTitle: {
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  infoText: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
});
