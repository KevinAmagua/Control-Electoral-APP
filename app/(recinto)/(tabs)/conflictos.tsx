import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { listLocalConflicts } from '@/data/local/sqliteClient';
import { DIGNITY_LABELS } from '@/domain/election/dignity';
import type { SyncConflict } from '@/domain/sync/operation';
import { formatDateTime } from '@/presentation/acta/geo';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { SectionTitle } from '@/presentation/acta/ui';
import { useOutboxSync } from '@/presentation/acta/useOutboxSync';
import {
  LargeTextInput,
  PrimaryButton,
  Screen,
  StatusFeedback,
  type FeedbackStatus,
} from '@/presentation/components';

type ConflictView = {
  id: string;
  mesaNumber: string;
  dignidad: SyncConflict['dignidad'];
  status: string;
  localVersion: number;
  remoteVersion: number;
  createdAt: string;
  source: 'servidor' | 'local';
  remote?: SyncConflict;
};

type Feedback = { status: FeedbackStatus; message: string };

export default function ConflictosScreen() {
  const { actorId, profile, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const { flush, error: syncError } = useOutboxSync();
  const [conflicts, setConflicts] = useState<ConflictView[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
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
        const { territory, actas } = dataContainer.repositories;
        const mesasResult = await territory.listMesas(recintoId);
        const conflictsResult = await actas.listConflicts(recintoId);
        if (!mesasResult.ok) throw new Error(mesasResult.error.message);
        if (!conflictsResult.ok) throw new Error(conflictsResult.error.message);

        const numbersById = new Map(mesasResult.value.map((mesa) => [mesa.id, mesa.number]));
        const mesaIds = new Set(mesasResult.value.map((mesa) => mesa.id));
        const localConflicts = await listLocalConflicts();
        const merged = new Map<string, ConflictView>();

        for (const conflict of localConflicts) {
          if (!mesaIds.has(conflict.mesaId)) {
            continue;
          }
          merged.set(conflict.id, {
            id: conflict.id,
            mesaNumber: numbersById.get(conflict.mesaId) ?? '—',
            dignidad: conflict.dignity,
            status: conflict.status,
            localVersion: conflict.localVersion,
            remoteVersion: conflict.remoteVersion,
            createdAt: conflict.createdAt,
            source: 'local',
          });
        }

        for (const conflict of conflictsResult.value) {
          if (!mesaIds.has(conflict.mesaId)) {
            continue;
          }
          merged.set(conflict.id, {
            id: conflict.id,
            mesaNumber: numbersById.get(conflict.mesaId) ?? '—',
            dignidad: conflict.dignidad,
            status: conflict.status,
            localVersion: conflict.localVersion,
            remoteVersion: conflict.remoteVersion,
            createdAt: conflict.createdAt,
            source: 'servidor',
            remote: conflict,
          });
        }

        const pending = Array.from(merged.values())
          .filter((conflict) => conflict.status === 'detectado' || conflict.status === 'en_revision')
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

        if (active) {
          setConflicts(pending);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'No fue posible cargar los conflictos.');
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

  useEffect(() => {
    if (!profile?.recintoId) {
      return;
    }

    const unsubscribe = dataContainer.repositories.actas.subscribeToConflicts(() => {
      setReloadToken((value) => value + 1);
    });
    return unsubscribe;
  }, [profile?.recintoId]);

  async function handleResolve(conflict: ConflictView, source: 'local' | 'remota') {
    if (!conflict.remote) {
      setFeedback({
        status: 'guardado_local',
        message: 'Conflicto guardado localmente y pendiente hasta que se recupere la conexión.',
      });
      return;
    }
    if (!actorId) {
      setFeedback({ status: 'validacion', message: 'No se pudo identificar al coordinador.' });
      return;
    }
    setBusyId(conflict.id);
    setFeedback(null);
    const result = await dataContainer.useCases.resolveConflict({
      actorId,
      conflictId: conflict.id,
      resolution: {
        fuente: source,
        version: source === 'local' ? conflict.localVersion : conflict.remoteVersion,
        nota: note.trim() || null,
        resueltoEn: new Date().toISOString(),
      },
    });
    setBusyId(null);
    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }
    setFeedback({
      status: 'guardado',
      message: `Conflicto de la mesa ${conflict.mesaNumber} resuelto con la versión ${source}.`,
    });
    setReloadToken((value) => value + 1);
  }

  return (
    <Screen
      title="Conflictos pendientes"
      subtitle="Conflictos de edición de actas del recinto"
      action={
        <PrimaryButton
          label="Actualizar"
          onPress={() => setReloadToken((value) => value + 1)}
          disabled={loading}
          tone="secondary"
        />
      }>
      {actorError || loadError || syncError ? (
        <StatusFeedback status="fallado" message={actorError ?? loadError ?? syncError ?? undefined} />
      ) : null}
      {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
      {loading || isActorLoading ? (
        <StatusFeedback status="en_proceso" message="Consultando conflictos..." />
      ) : (
        <StatusFeedback
          status={conflicts.length === 0 ? 'guardado' : 'validacion'}
          message={
            conflicts.length === 0
              ? 'No hay conflictos pendientes en el recinto.'
              : `${conflicts.length} conflictos requieren revisión.`
          }
        />
      )}

      <PrimaryButton
        label="Sincronizar conflictos locales"
        onPress={() => {
          void flush().then(() => setReloadToken((value) => value + 1));
        }}
        tone="secondary"
      />

      <LargeTextInput
        label="Nota de resolución"
        value={note}
        onChangeText={setNote}
        placeholder="Detalle de la decisión tomada"
        multiline
      />

      {conflicts.map((conflict) => (
        <View key={conflict.id} style={styles.card}>
          <SectionTitle
            title={`Mesa ${conflict.mesaNumber} · ${DIGNITY_LABELS[conflict.dignidad]}`}
            subtitle={`Detectado: ${formatDateTime(conflict.createdAt)} · Origen: ${conflict.source}`}
          />
          <View style={styles.versions}>
            <Text style={styles.version}>Versión local: {conflict.localVersion}</Text>
            <Text style={styles.version}>Versión recibida: {conflict.remoteVersion}</Text>
            <Text style={styles.version}>Estado: {conflict.status}</Text>
          </View>
          <PrimaryButton
            label="Usar versión recibida"
            onPress={() => {
              void handleResolve(conflict, 'remota');
            }}
            isLoading={busyId === conflict.id}
            disabled={busyId !== null}
          />
          <PrimaryButton
            label="Conservar versión local"
            onPress={() => {
              void handleResolve(conflict, 'local');
            }}
            isLoading={busyId === conflict.id}
            disabled={busyId !== null}
          />
        </View>
      ))}
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
  versions: {
    gap: spacing.xs,
  },
  version: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
});
