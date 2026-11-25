import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { captureError } from '@/data/monitoring/sentry';
import type { Acta } from '@/domain/acta/acta';
import { DIGNITIES, DIGNITY_LABELS, type Dignity } from '@/domain/election/dignity';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
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

export default function MesasScreen() {
  const { actorId, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const { syncing, error: syncError, revision } = useOutboxSync();
  const [rows, setRows] = useState<MesaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partialData, setPartialData] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const finishLoading = useCallback(() => {
    void Promise.resolve().then(() => setLoading(false));
  }, []);

  const startLoading = useCallback(() => {
    void Promise.resolve().then(() => {
      setLoading(true);
      setLoadError(null);
      setPartialData(false);
      setRows([]);
    });
  }, []);

  useEffect(() => {
    let active = true;

    if (!actorId) {
      startLoading();
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

          if (!localResult.ok) {
            throw new Error(localResult.error.message);
          }

          const missingReferenceData =
            !assignmentsResult.ok ||
            !mesasResult.ok ||
            !recintosResult.ok ||
            !actasResult.ok;
          const assigned = assignmentsResult.ok
            ? assignmentsResult.value.filter(
                (assignment) => assignment.active && !assignment.unassignedAt,
              )
            : [];
          const assignedMesaIds = assignmentsResult.ok
            ? new Set(assigned.map((assignment) => assignment.mesaId))
            : null;
          const mesasById = mesasResult.ok
            ? new Map(mesasResult.value.map((mesa) => [mesa.id, mesa]))
            : new Map<string, Mesa>();
          const recintosById = recintosResult.ok
            ? new Map(recintosResult.value.map((recinto) => [recinto.id, recinto]))
            : new Map<string, Recinto>();
          const remoteActas = actasResult.ok
            ? actasResult.value.filter(
                (acta) => !assignedMesaIds || assignedMesaIds.has(acta.mesaId),
              )
            : [];
          const localOperations = localResult.value.filter(
            (item) => !assignedMesaIds || assignedMesaIds.has(item.mesaId),
          );

          const buildRow = (mesa: Mesa): MesaRow => {
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
            return {
              mesa,
              recintoName: recinto?.name ?? 'Recinto no disponible',
              actas: mesaActas,
              local: mesaLocal,
            };
          };

          const nextRows: MesaRow[] = assigned
            .map((assignment) => mesasById.get(assignment.mesaId))
            .filter((mesa): mesa is Mesa => Boolean(mesa))
            .map(buildRow);
          const additionalMesaIds = Array.from(
            new Set(localOperations.map((operation) => operation.mesaId)),
          );
          for (const mesaId of additionalMesaIds) {
            if (assignedMesaIds?.has(mesaId)) {
              continue;
            }
            const mesa = mesasById.get(mesaId);
            if (mesa) {
              nextRows.push(buildRow(mesa));
            }
          }

          if (active) {
            setPartialData(missingReferenceData);
            setRows(nextRows);
          }
        } catch (error) {
          captureError(error, { scope: 'mesas.load' });
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
  }, [actorId, finishLoading, reloadToken, revision, startLoading]);

  function statusFor(row: MesaRow, dignidad: Dignity): DisplayStatus {
    const local = row.local[dignidad];
    if (local?.status === 'fallado') {
      return 'fallado';
    }
    if (local?.status === 'pendiente') {
      return 'pendiente';
    }
    if (local?.status === 'en_proceso') {
      return 'en_proceso';
    }
    if (local?.status === 'guardado') {
      return 'enviado';
    }
    const remoteStatus = row.actas[dignidad]?.estado ?? null;
    return remoteStatus === 'guardado' ? 'enviado' : remoteStatus;
  }

  const feedbackMessage = actorError ?? loadError ?? syncError ?? undefined;
  const summary = loading || isActorLoading
    ? 'Consultando asignaciones...'
    : rows.length === 0
      ? 'Sin mesas asignadas'
      : `${rows.length} mesas asignadas`;

  return (
    <Screen
      title="Mesas asignadas"
      action={
        <PrimaryButton
          compact
          label="Actualizar"
          onPress={() => setReloadToken((value) => value + 1)}
          disabled={loading}
          tone="secondary"
        />
      }>
      <Text style={styles.summary}>{summary}</Text>

      {feedbackMessage ? (
        <StatusFeedback status="fallado" message={feedbackMessage} />
      ) : syncing ? (
        <Text style={styles.syncing}>Sincronizando actas pendientes...</Text>
      ) : null}
      {partialData ? (
        <StatusFeedback
          status="guardado_local"
          message="Sin conexión: mostrando las mesas y estados disponibles en el dispositivo."
        />
      ) : null}

      {rows.map((row) => (
        <View key={row.mesa.id} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.mesaNumber}>Mesa {row.mesa.number}</Text>
            <Text style={styles.recinto}>{row.recintoName}</Text>
          </View>
          <Text style={styles.meta}>
            {[row.mesa.location, `${row.mesa.registeredVoters} electores`]
              .filter(Boolean)
              .join(' · ')}
          </Text>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    color: palette.accent,
    fontSize: typography.caption,
    fontWeight: '700',
    flexShrink: 1,
  },
  syncing: {
    color: palette.warning,
    fontSize: typography.caption,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mesaNumber: {
    color: palette.primary,
    fontSize: typography.heading,
    fontWeight: '700',
    flexShrink: 0,
  },
  recinto: {
    color: palette.textMuted,
    fontSize: typography.caption,
    flex: 1,
    textAlign: 'right',
  },
  meta: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  dignityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
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
