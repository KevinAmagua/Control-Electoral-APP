import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import type { LocalOutboxStatus } from '@/data/local/sqliteClient';
import { DIGNITY_LABELS } from '@/domain/election/dignity';
import { formatDateTime, formatCoordinate } from '@/presentation/acta/geo';
import {
  listLocalActaOperations,
  type LocalActaOperation,
} from '@/presentation/acta/outbox-status';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { useOutboxSync } from '@/presentation/acta/useOutboxSync';
import {
  PrimaryButton,
  Screen,
  StatusFeedback,
  type FeedbackStatus,
} from '@/presentation/components';

type OperationView = LocalActaOperation & { mesaNumber: string };

function getSyncStatus(
  operations: OperationView[],
  syncing: boolean,
  syncError: string | null,
): FeedbackStatus {
  if (syncing) {
    return 'en_proceso';
  }
  if (syncError || operations.some((operation) => operation.status === 'fallado')) {
    return 'fallado';
  }
  if (
    operations.some(
      (operation) => operation.status === 'pendiente' || operation.status === 'en_proceso',
    )
  ) {
    return 'guardado_local';
  }
  return operations.length === 0 ? 'guardado' : 'enviado';
}

function getSyncSummary(
  operations: OperationView[],
  syncing: boolean,
  syncError: string | null,
): string {
  const pendingCount = operations.filter(
    (operation) => operation.status === 'pendiente' || operation.status === 'en_proceso',
  ).length;
  const failedCount = operations.filter((operation) => operation.status === 'fallado').length;
  const syncedOperations = operations
    .filter((operation) => operation.status === 'guardado')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (syncing) {
    return `Sincronización en curso: ${pendingCount} actas en cola.`;
  }
  if (syncError) {
    return `No se completó la sincronización: ${syncError}`;
  }
  if (failedCount > 0) {
    return `${failedCount} actas necesitan atención. Revise el detalle de cada operación.`;
  }
  if (pendingCount > 0) {
    return `${pendingCount} actas guardadas en el dispositivo esperan sincronización.`;
  }
  if (syncedOperations.length === 0) {
    return 'No hay actas guardadas en este dispositivo.';
  }

  return `${syncedOperations.length} actas sincronizadas. Última acta enviada: ${formatDateTime(
    syncedOperations[0].updatedAt,
  )}.`;
}

function toFeedbackStatus(status: LocalOutboxStatus): FeedbackStatus {
  if (status === 'guardado') {
    return 'enviado';
  }
  if (status === 'fallado') {
    return 'fallado';
  }
  return 'guardado_local';
}

export default function EstadosActaScreen() {
  const { actorId, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const { flush, syncing, error: syncError } = useOutboxSync();
  const [operations, setOperations] = useState<OperationView[]>([]);
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
        const { assignments, territory } = dataContainer.repositories;
        const [assignedResult, mesasResult, localResult] = await Promise.all([
          assignments.listByVeedor(actorId as string),
          territory.listMesas(),
          listLocalActaOperations(),
        ]);

        if (!assignedResult.ok) {
          throw new Error(assignedResult.error.message);
        }
        if (!mesasResult.ok) {
          throw new Error(mesasResult.error.message);
        }
        if (!localResult.ok) {
          throw new Error(localResult.error.message);
        }

        const mesaIds = new Set(
          assignedResult.value
            .filter((assignment) => assignment.active && !assignment.unassignedAt)
            .map((assignment) => assignment.mesaId),
        );
        const numbersById = new Map(mesasResult.value.map((mesa) => [mesa.id, mesa.number]));
        const views = localResult.value
          .filter((operation) => mesaIds.has(operation.mesaId))
          .map((operation) => ({
            ...operation,
            mesaNumber: numbersById.get(operation.mesaId) ?? '—',
          }));

        if (active) {
          setOperations(views);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'No fue posible leer la cola local.');
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

  async function handleFlush() {
    await flush();
    setReloadToken((value) => value + 1);
  }

  return (
    <Screen
      title="Estados de guardado"
      subtitle="Cola SQLite del dispositivo"
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
      {loading || isActorLoading ? (
        <StatusFeedback status="en_proceso" message="Leyendo operaciones pendientes..." />
      ) : (
        <StatusFeedback
          status={getSyncStatus(operations, syncing, syncError)}
          message={getSyncSummary(operations, syncing, syncError)}
        />
      )}

      <PrimaryButton
        label="Sincronizar ahora"
        onPress={() => {
          void handleFlush();
        }}
        isLoading={syncing}
        disabled={syncing}
      />

      {operations.map((operation) => (
        <View key={operation.operationId} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Mesa {operation.mesaNumber} · {DIGNITY_LABELS[operation.dignity]}
            </Text>
            <Text style={styles.attempts}>Intentos: {operation.attemptCount}</Text>
          </View>
          <StatusFeedback
            status={toFeedbackStatus(operation.status)}
            message={
              operation.lastError ??
              `Última actualización registrada: ${formatDateTime(operation.updatedAt)}`
            }
          />
          <View style={styles.details}>
            <Text style={styles.detail}>Operación: {operation.operationId}</Text>
            <Text style={styles.detail}>Versión local: {operation.version}</Text>
            <Text style={styles.detail}>Sufragantes: {operation.totalSufragantes}</Text>
            <Text style={styles.detail}>
              GPS: {formatCoordinate(operation.gpsLat)}, {formatCoordinate(operation.gpsLng)} (±
              {Math.round(operation.gpsPrecision)} m)
            </Text>
            <Text style={styles.detail}>Foto: {operation.fotoPath}</Text>
          </View>
        </View>
      ))}

      <PrimaryButton label="Volver a mesas" onPress={() => router.back()} tone="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
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
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  attempts: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  details: {
    gap: spacing.xs,
  },
  detail: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
});
