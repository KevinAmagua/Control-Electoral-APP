import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import type { Acta } from '@/domain/acta/acta';
import { DIGNITIES, DIGNITY_LABELS, type Dignity } from '@/domain/election/dignity';
import type { Mesa } from '@/domain/election/mesa';
import { PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import { listLocalActaOperations, type LocalActaOperation } from '@/presentation/acta/outbox-status';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { StatusChip, type DisplayStatus } from '@/presentation/acta/ui';
import { useOutboxSync } from '@/presentation/acta/useOutboxSync';

type MesaRow = {
  mesa: Mesa;
  recintoName: string;
  actas: Partial<Record<Dignity, Acta>>;
  local: Partial<Record<Dignity, LocalActaOperation>>;
};

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export default function MesasScreen() {
  const { session, actorId, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const { syncing, error: syncError } = useOutboxSync();
  const [rows, setRows] = useState<MesaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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

    if (!actorId) {
      finishLoading();
      return;
    }

    startLoading();

    async function load() {
      try {
        const { assignments, territory, actas } = dataContainer.repositories;
        const [assignmentsResult, mesasResult, recintosResult, actasResult, localResult] =
          await Promise.all([
            assignments.listByVeedor(actorId as string),
            territory.listMesas(),
            territory.listRecintos(),
            actas.listAll(),
            listLocalActaOperations(),
          ]);

        const assigned = unwrap(assignmentsResult).filter(
          (assignment) => assignment.active && !assignment.unassignedAt,
        );
        const assignedMesaIds = new Set(assigned.map((assignment) => assignment.mesaId));
        const mesasById = new Map(unwrap(mesasResult).map((mesa) => [mesa.id, mesa]));
        const recintosById = new Map(unwrap(recintosResult).map((recinto) => [recinto.id, recinto]));
        const remoteActas = unwrap(actasResult).filter((acta) => assignedMesaIds.has(acta.mesaId));
        const localOperations = unwrap(localResult).filter((item) =>
          assignedMesaIds.has(item.mesaId),
        );

        const nextRows: MesaRow[] = [];
        for (const assignment of assigned) {
          const mesa = mesasById.get(assignment.mesaId);
          if (!mesa) {
            continue;
          }
          const recinto = mesa.recintoId ? recintosById.get(mesa.recintoId) : undefined;
          const mesaActas: Partial<Record<Dignity, Acta>> = {};
          const mesaLocal: Partial<Record<Dignity, LocalActaOperation>> = {};
          for (const acta of remoteActas) {
            if (acta.mesaId === mesa.id) {
              mesaActas[acta.dignidad] = acta;
            }
          }
          for (const operation of localOperations) {
            if (operation.mesaId === mesa.id) {
              mesaLocal[operation.dignity] = operation;
            }
          }
          nextRows.push({
            mesa,
            recintoName: recinto?.name ?? 'Recinto no disponible',
            actas: mesaActas,
            local: mesaLocal,
          });
        }

        if (active) {
          setRows(nextRows);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'No fue posible cargar sus mesas.');
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
  }, [actorId, finishLoading, reloadToken, startLoading]);

  function statusFor(row: MesaRow, dignidad: Dignity): DisplayStatus {
    const local = row.local[dignidad];
    if (local?.status === 'fallado') {
      return 'fallado';
    }
    if (local?.status === 'pendiente' || local?.status === 'en_proceso') {
      return 'en_proceso';
    }
    return row.actas[dignidad]?.estado ?? null;
  }

  async function handleSignOut() {
    await session.signOut();
    router.replace('/login');
  }

  return (
    <Screen
      title="Mesas asignadas"
      subtitle="Solo las mesas asignadas a su usuario"
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
      {syncError ? (
        <StatusFeedback status="fallado" message={`Sincronización: ${syncError}`} />
      ) : null}
      {syncing ? (
        <StatusFeedback status="en_proceso" message="Sincronizando actas pendientes..." />
      ) : null}
      {loading || isActorLoading ? (
        <StatusFeedback status="en_proceso" message="Consultando asignaciones..." />
      ) : (
        <StatusFeedback
          status="guardado"
          message={
            rows.length === 0
              ? 'No tiene mesas asignadas activamente.'
              : `${rows.length} mesas asignadas cargadas correctamente.`
          }
        />
      )}

      <PrimaryButton
        label="Ver estado de sincronización"
        onPress={() => router.push('/estados-acta')}
        tone="secondary"
      />

      {rows.map((row) => (
        <View key={row.mesa.id} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.mesaNumber}>Mesa {row.mesa.number}</Text>
            <Text style={styles.recinto}>{row.recintoName}</Text>
          </View>
          <Text style={styles.location}>{row.mesa.location}</Text>
          <Text style={styles.voters}>{row.mesa.registeredVoters} electores registrados</Text>

          {DIGNITIES.map((dignidad) => {
            const status = statusFor(row, dignidad);
            const acta = row.actas[dignidad];
            return (
              <Pressable
                key={dignidad}
                accessibilityRole="button"
                style={styles.dignityRow}
                onPress={() =>
                  router.push({
                    pathname: '/registrar-acta',
                    params: { mesaId: row.mesa.id, dignidad },
                  })
                }>
                <View style={styles.dignityText}>
                  <Text style={styles.dignityLabel}>{DIGNITY_LABELS[dignidad]}</Text>
                  <Text style={styles.dignityAction}>
                    {acta ? 'Corregir acta' : 'Registrar acta'}
                  </Text>
                </View>
                <StatusChip status={status} />
              </Pressable>
            );
          })}
        </View>
      ))}

      <PrimaryButton label="Cerrar sesión" onPress={handleSignOut} tone="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mesaNumber: {
    color: palette.primary,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  recinto: {
    color: palette.textMuted,
    fontSize: typography.caption,
    minWidth: 0,
    flexShrink: 1,
    textAlign: 'right',
  },
  location: {
    color: palette.text,
    fontSize: typography.body,
  },
  voters: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  dignityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  },
  dignityText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  dignityLabel: {
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  dignityAction: {
    color: palette.primary,
    fontSize: typography.caption,
  },
});
