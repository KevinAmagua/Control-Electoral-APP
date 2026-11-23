import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import type { Assignment } from '@/domain/election/assignment';
import type { Mesa } from '@/domain/election/mesa';
import type { UserProfile } from '@/domain/user/profile';
import { fullName } from '@/domain/user/profile';
import { assignVeedorFormSchema } from '@/domain/validation/user';
import { formatDateTime } from '@/presentation/acta/geo';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { OptionButton, SectionTitle } from '@/presentation/acta/ui';
import {
  LargeTextInput,
  PrimaryButton,
  Screen,
  StatusFeedback,
  type FeedbackStatus,
} from '@/presentation/components';

type MesaAssignmentRow = {
  mesa: Mesa;
  assignment: Assignment | null;
  veedorName: string;
};

type Feedback = { status: FeedbackStatus; message: string };
type AssignmentValues = z.input<typeof assignVeedorFormSchema>;
type AssignmentResult = z.output<typeof assignVeedorFormSchema>;

export default function AsignarVeedoresScreen() {
  const { actorId, profile, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const [rows, setRows] = useState<MesaAssignmentRow[]>([]);
  const [veedores, setVeedores] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentValues, unknown, AssignmentResult>({
    resolver: zodResolver(assignVeedorFormSchema),
    mode: 'onChange',
    defaultValues: { mesaIds: [], veedorId: null, reason: '' },
  });
  const mesaIds = useWatch({ control, name: 'mesaIds' });
  const veedorId = useWatch({ control, name: 'veedorId' });
  const reason = useWatch({ control, name: 'reason' });

  const finishLoading = useCallback(() => {
    void Promise.resolve().then(() => setLoading(false));
  }, []);

  const startLoading = useCallback(() => {
    void Promise.resolve().then(() => {
      setLoading(true);
      setLoadError(null);
    });
  }, []);

  useEffect(() => {
    let active = true;

    if (!profile?.recintoId) {
      if (!isActorLoading) {
        finishLoading();
      }
      return;
    }

    startLoading();

    async function load() {
      try {
        const recintoId = profile?.recintoId as string;
        const { territory, assignments, users } = dataContainer.repositories;
        const [mesasResult, usersResult] = await Promise.all([
          territory.listMesas(recintoId),
          users.listByRecinto(recintoId),
        ]);
        if (!mesasResult.ok) throw new Error(mesasResult.error.message);
        if (!usersResult.ok) throw new Error(usersResult.error.message);

        const activeResults = await Promise.all(
          mesasResult.value.map((mesa) => assignments.getActiveByMesa(mesa.id)),
        );
        const usersById = new Map(usersResult.value.map((user) => [user.id, user]));
        const nextRows = mesasResult.value.map((mesa, index) => {
          const result = activeResults[index];
          const assignment = result.ok ? result.value : null;
          const assignedUser = assignment ? usersById.get(assignment.veedorId) : undefined;
          return {
            mesa,
            assignment,
            veedorName: assignedUser ? fullName(assignedUser) : 'Sin veedor asignado',
          };
        });

        if (active) {
          setRows(nextRows);
          setVeedores(
            usersResult.value.filter((user) => user.role === 'veedor' && user.active),
          );
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'No fue posible cargar las asignaciones.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [profile?.recintoId, isActorLoading, finishLoading, reloadToken, startLoading]);

  const selectedRows = rows.filter((row) => mesaIds.includes(row.mesa.id));
  const activeVeedorIds = selectedRows.map((row) => row.assignment?.veedorId ?? null);
  const previousVeedorId =
    selectedRows.length > 0 && activeVeedorIds.every((id) => id === activeVeedorIds[0])
      ? activeVeedorIds[0]
      : null;
  const hasAnyAssignment = activeVeedorIds.some((id) => id !== null);
  const canAssign = selectedRows.length > 0 && veedorId !== null && !hasAnyAssignment;
  const canReplace =
    selectedRows.length > 0 &&
    veedorId !== null &&
    previousVeedorId !== null &&
    veedorId !== previousVeedorId &&
    reason.trim().length > 0;

  function toggleMesa(mesaId: string) {
    setFeedback(null);
    const current = getValues('mesaIds');
    setValue(
      'mesaIds',
      current.includes(mesaId) ? current.filter((item) => item !== mesaId) : [...current, mesaId],
      { shouldValidate: true },
    );
  }

  async function handleAssign(values: AssignmentResult) {
    if (!actorId || !canAssign) {
      setError('mesaIds', { type: 'server', message: 'Seleccione mesas libres y un veedor' });
      return;
    }
    setFeedback(null);
    const result = await dataContainer.useCases.assignVeedor({
      actorId,
      veedorId: values.veedorId,
      mesaIds: values.mesaIds,
      reason: values.reason.length > 0 ? values.reason : undefined,
    });
    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }
    setFeedback({
      status: 'guardado',
      message: `${result.value.length} asignaciones registradas correctamente.`,
    });
    reset({ mesaIds: [], veedorId: null, reason: values.reason });
    setReloadToken((value) => value + 1);
  }

  async function handleReplace(values: AssignmentResult) {
    if (!actorId || !veedorId || !previousVeedorId || !canReplace) {
      setFeedback({
        status: 'validacion',
        message: 'Seleccione mesas con el mismo veedor, un sustituto y el motivo.',
      });
      return;
    }
    if (values.reason.trim().length === 0) {
      setError('reason', { type: 'server', message: 'Indique el motivo del reemplazo' });
      return;
    }
    setFeedback(null);
    const result = await dataContainer.useCases.replaceVeedor({
      actorId,
      mesaIds: values.mesaIds,
      previousVeedorId,
      nextVeedorId: values.veedorId,
      reason: values.reason,
    });
    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }
    setFeedback({
      status: 'guardado',
      message: `${result.value.length} reemplazos registrados correctamente.`,
    });
    reset({ mesaIds: [], veedorId: null, reason: '' });
    setReloadToken((value) => value + 1);
  }

  return (
    <Screen
      title="Asignar veedores"
      subtitle="Mesas reales y veedores activos del recinto"
      action={
        <PrimaryButton
          label="Actualizar"
          onPress={() => setReloadToken((value) => value + 1)}
          disabled={loading}
          tone="secondary"
        />
      }>
      {actorError || loadError ? (
        <StatusFeedback status="fallado" message={actorError ?? loadError ?? undefined} />
      ) : null}
      {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
      {loading || isActorLoading ? (
        <StatusFeedback status="en_proceso" message="Cargando mesas y veedores..." />
      ) : (
        <StatusFeedback
          status="guardado"
          message={`${rows.length} mesas y ${veedores.length} veedores disponibles.`}
        />
      )}

      <SectionTitle
        title="Mesas"
        subtitle="Seleccione una o varias mesas para asignar o reasignar."
      />
      {errors.mesaIds?.message ? (
        <StatusFeedback status="validacion" message={errors.mesaIds.message} />
      ) : null}
      {rows.map((row) => {
        const selected = mesaIds.includes(row.mesa.id);
        return (
          <Pressable
            key={row.mesa.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => toggleMesa(row.mesa.id)}
            style={[styles.row, selected && styles.rowSelected]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Mesa {row.mesa.number}</Text>
              <Text style={styles.rowDetail}>{row.mesa.location}</Text>
              <Text style={styles.rowDetail}>Veedor actual: {row.veedorName}</Text>
              {row.assignment?.assignedAt ? (
                <Text style={styles.rowDetail}>
                  Desde {formatDateTime(row.assignment.assignedAt)}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.check, selected && styles.checkSelected]}>
              {selected ? 'Seleccionada' : 'Seleccionar'}
            </Text>
          </Pressable>
        );
      })}

      <SectionTitle title="Veedor" subtitle="Seleccione el veedor que cubrirá las mesas." />
      {errors.veedorId?.message ? (
        <StatusFeedback status="validacion" message={errors.veedorId.message} />
      ) : null}
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
      {veedores.length === 0 && !loading ? (
        <StatusFeedback status="validacion" message="No hay veedores activos en este recinto." />
      ) : null}

      <Controller
        control={control}
        name="reason"
        render={({ field }) => (
          <LargeTextInput
            label="Motivo"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="Motivo de la asignación o reemplazo"
            multiline
            error={errors.reason?.message ?? null}
          />
        )}
      />

      {mesaIds.length > 0 ? (
        <PrimaryButton
          label="Crear veedor sustituto"
          onPress={() =>
            router.push({
              pathname: '/nuevo-veedor',
              params: { mesas: mesaIds.join(',') },
            })
          }
          tone="secondary"
        />
      ) : null}
      <PrimaryButton
        label="Asignar veedor"
        onPress={handleSubmit(handleAssign, () => setFeedback(null))}
        isLoading={isSubmitting}
        disabled={isSubmitting || !canAssign}
      />
      <PrimaryButton
        label="Reasignar veedor"
        onPress={handleSubmit(handleReplace, () => setFeedback(null))}
        isLoading={isSubmitting}
        disabled={isSubmitting || !canReplace}
        tone="secondary"
      />
      {mesaIds.length > 0 && previousVeedorId === null && hasAnyAssignment ? (
        <StatusFeedback
          status="validacion"
          message="Para reasignar, todas las mesas seleccionadas deben tener el mismo veedor activo."
        />
      ) : null}
      <PrimaryButton label="Volver al recinto" onPress={() => router.back()} tone="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  rowSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryLight,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  rowDetail: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  check: {
    color: palette.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  checkSelected: {
    color: palette.primary,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
