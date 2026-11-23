import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { normalizeCedula } from '@/domain/validation/cedula';
import { createUserSchema } from '@/domain/validation/user';
import { useActorProfile } from '@/presentation/acta/session-actor';
import {
  LargeTextInput,
  PrimaryButton,
  Screen,
  StatusFeedback,
  type FeedbackStatus,
} from '@/presentation/components';

type CreateUserValues = z.input<typeof createUserSchema>;
type CreateUserResult = z.output<typeof createUserSchema>;

export default function NuevoVeedorScreen() {
  const params = useLocalSearchParams<{ mesas?: string }>();
  const { actorId, profile, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const [feedback, setFeedback] = useState<{ status: FeedbackStatus; message: string } | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserValues, unknown, CreateUserResult>({
    resolver: zodResolver(createUserSchema),
    mode: 'onChange',
    defaultValues: {
      role: 'veedor',
      cedula: '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      recintoId: null,
    },
  });

  useEffect(() => {
    if (profile?.recintoId) {
      setValue('recintoId', profile.recintoId);
    }
  }, [profile?.recintoId, setValue]);

  const mesaIds = (params.mesas ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const onSubmit = async (values: CreateUserResult) => {
    if (!actorId || !profile?.recintoId) {
      return;
    }
    if (values.recintoId !== profile.recintoId) {
      setError('recintoId', {
        type: 'server',
        message: 'Solo puede crear veedores de su recinto',
      });
      return;
    }

    setFeedback(null);
    const created = await dataContainer.useCases.createAccount({
      ...values,
      createdBy: actorId,
    });

    if (!created.ok) {
      if (created.error.code === 'CEDULA_YA_REGISTRADA' || created.error.code === 'REGISTRO_DUPLICADO') {
        setError('cedula', { type: 'server', message: created.error.message });
      } else if (created.error.code === 'CORREO_YA_REGISTRADO') {
        setError('email', { type: 'server', message: created.error.message });
      } else if (
        created.error.code === 'FUERA_DE_JURISDICCION' ||
        created.error.code === 'RECINTO_FUERA_DE_JURISDICCION'
      ) {
        setError('recintoId', { type: 'server', message: created.error.message });
      } else {
        setFeedback({ status: 'fallado', message: created.error.message });
      }
      return;
    }

    if (mesaIds.length > 0) {
      const assigned = await dataContainer.useCases.assignVeedor({
        actorId,
        veedorId: created.value.id,
        mesaIds,
        reason: 'Veedor sustituto creado desde el recinto',
      });
      if (!assigned.ok) {
        setFeedback({
          status: 'fallado',
          message: `La cuenta se creó pero no se pudo asignar: ${assigned.error.message}`,
        });
        return;
      }
    }

    setFeedback({
      status: 'guardado',
      message: mesaIds.length > 0
        ? 'Veedor creado y asignado a las mesas seleccionadas'
        : 'Veedor creado correctamente',
    });
    router.back();
  };

  return (
    <Screen
      title="Nuevo veedor"
      subtitle="Cuenta sustituta con acceso inmediato a las mesas seleccionadas">
      <View style={styles.form}>
        {actorError ? <StatusFeedback status="fallado" message={actorError} /> : null}
        {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
        {isActorLoading ? (
          <StatusFeedback status="en_proceso" message="Validando permisos..." />
        ) : null}
        {mesaIds.length > 0 ? (
          <StatusFeedback
            status="en_proceso"
            message={`Se asignarán ${mesaIds.length} mesa(s) al crear la cuenta`}
          />
        ) : null}
        {errors.recintoId?.message ? (
          <StatusFeedback status="validacion" message={errors.recintoId.message} />
        ) : null}
        <Controller
          control={control}
          name="cedula"
          render={({ field }) => (
            <LargeTextInput
              label="Cédula"
              value={field.value}
              onChangeText={(value) => field.onChange(normalizeCedula(value))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={10}
              error={errors.cedula?.message ?? null}
            />
          )}
        />
      <Controller
        control={control}
        name="firstName"
          render={({ field }) => (
            <LargeTextInput
              label="Nombres"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.firstName?.message ?? null}
            />
          )}
        />
        <Controller
          control={control}
          name="lastName"
          render={({ field }) => (
            <LargeTextInput
              label="Apellidos"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.lastName?.message ?? null}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <LargeTextInput
              label="Teléfono"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="phone-pad"
              placeholder="09XXXXXXXX o +5939XXXXXXXX"
              error={errors.phone?.message ?? null}
            />
          )}
        />
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
              error={errors.email?.message ?? null}
            />
          )}
        />
        <PrimaryButton
          label="Crear y asignar veedor"
          onPress={handleSubmit(onSubmit, () => setFeedback(null))}
          isLoading={isSubmitting}
          disabled={isSubmitting || isActorLoading || !profile?.recintoId}
        />
        <PrimaryButton label="Cancelar" onPress={() => router.back()} tone="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
});
