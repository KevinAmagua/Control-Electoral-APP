import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme';
import { dataContainer } from '@/data/container';
import type { UserProfile } from '@/domain/user/profile';
import { fullName } from '@/domain/user/profile';
import {
  createMesaSchema,
  normalizeMesaNumber,
} from '@/domain/validation/territory';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { OptionButton, SectionTitle } from '@/presentation/acta/ui';
import {
  LargeTextInput,
  PrimaryButton,
  Screen,
  StatusFeedback,
  type FeedbackStatus,
} from '@/presentation/components';

type MesaFormValues = z.input<typeof createMesaSchema>;
type MesaFormResult = z.output<typeof createMesaSchema>;
type Feedback = { status: FeedbackStatus; message: string } | null;

export default function NuevaMesaScreen() {
  const { actorId, profile, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const [veedores, setVeedores] = useState<UserProfile[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MesaFormValues, unknown, MesaFormResult>({
    resolver: zodResolver(createMesaSchema),
    mode: 'onChange',
    defaultValues: { number: '', registeredVoters: '', location: '', veedorId: null },
  });
  const veedorId = useWatch({ control, name: 'veedorId' });

  useEffect(() => {
    let active = true;
    if (!profile?.recintoId) {
      return;
    }

    void (async () => {
      const result = await dataContainer.repositories.users.listByRecinto(profile.recintoId as string);
      if (!active) {
        return;
      }
      if (!result.ok) {
        setFeedback({ status: 'fallado', message: result.error.message });
        return;
      }
      setVeedores(result.value.filter((user) => user.role === 'veedor' && user.active));
    })();

    return () => {
      active = false;
    };
  }, [profile?.recintoId]);

  const onSubmit = async (values: MesaFormResult) => {
    if (!actorId || !profile?.recintoId) {
      setFeedback({
        status: 'validacion',
        message: 'No se pudo identificar el recinto del coordinador',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const created = await dataContainer.repositories.territory.createMesa({
      recintoId: profile.recintoId,
      number: values.number,
      registeredVoters: values.registeredVoters,
      location: values.location,
    });

    if (!created.ok) {
      setSubmitting(false);
      setFeedback({ status: 'fallado', message: created.error.message });
      return;
    }

    if (values.veedorId) {
      const assigned = await dataContainer.useCases.assignVeedor({
        actorId,
        veedorId: values.veedorId,
        mesaIds: [created.value.id],
        reason: 'Asignación inicial al registrar la mesa',
      });
      if (!assigned.ok) {
        setSubmitting(false);
        setFeedback({
          status: 'fallado',
          message: `La mesa se creó pero no se pudo asignar: ${assigned.error.message}`,
        });
        return;
      }
    }

    setSubmitting(false);
    setFeedback({
      status: 'guardado',
      message: values.veedorId
        ? `Mesa ${created.value.number} creada y asignada correctamente`
        : `Mesa ${created.value.number} creada sin veedor asignado`,
    });
    reset({ number: '', registeredVoters: '', location: '', veedorId: null });
    router.back();
  };

  return (
    <Screen
      title="Nueva mesa"
      subtitle={profile?.recintoId ? 'Registre una mesa en su recinto' : 'Cargando recinto...'}>
      {actorError ? <StatusFeedback status="fallado" message={actorError} /> : null}
      {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
      {isActorLoading ? (
        <StatusFeedback status="en_proceso" message="Consultando el recinto..." />
      ) : null}

      <Controller
        control={control}
        name="number"
        render={({ field }) => (
          <LargeTextInput
            label="Número de mesa"
            value={field.value}
            onChangeText={(value) => field.onChange(normalizeMesaNumber(value))}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="001"
            error={errors.number?.message ?? null}
          />
        )}
      />
      <Controller
        control={control}
        name="registeredVoters"
        render={({ field }) => (
          <LargeTextInput
            label="Electores registrados"
            value={field.value}
            onChangeText={(value) => field.onChange(value.replace(/\D/g, ''))}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            placeholder="300"
            error={errors.registeredVoters?.message ?? null}
          />
        )}
      />
      <Controller
        control={control}
        name="location"
        render={({ field }) => (
          <LargeTextInput
            label="Ubicación dentro del recinto"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="Aula 1, planta baja"
            error={errors.location?.message ?? null}
          />
        )}
      />

      <SectionTitle title="Veedor" subtitle="Se asignará al registrar la mesa." />
      <View style={styles.optionGrid}>
        {veedores.map((veedor) => (
          <OptionButton
            key={veedor.id}
            label={fullName(veedor)}
            selected={veedor.id === veedorId}
            onPress={() => {
              setFeedback(null);
              setValue('veedorId', veedor.id, { shouldValidate: true });
            }}
          />
        ))}
      </View>
      {veedores.length === 0 && !isActorLoading ? (
        <StatusFeedback
          status="validacion"
          message="No hay veedores activos en este recinto. Puede crear la mesa y asignar después."
        />
      ) : null}

      <PrimaryButton
        label="Crear mesa"
        onPress={handleSubmit(onSubmit, () => setFeedback(null))}
        isLoading={submitting || isSubmitting}
        disabled={submitting || isSubmitting || isActorLoading || !profile?.recintoId}
        tone="accent"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
