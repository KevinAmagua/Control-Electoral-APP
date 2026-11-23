import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme';
import { dataContainer } from '@/data/container';
import type { Acta } from '@/domain/acta/acta';
import type { ActaStatus } from '@/domain/acta/acta-status';
import { DIGNITIES, DIGNITY_LABELS, type Dignity } from '@/domain/election/dignity';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
import { ActaReviewList } from '@/presentation/acta/ActaReview';
import { listAllCandidateOptions } from '@/presentation/acta/candidates';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { OptionButton, SectionTitle } from '@/presentation/acta/ui';
import { PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';

type ReviewData = {
  actas: Acta[];
  mesasById: Map<string, Mesa>;
  recintosById: Map<string, Recinto>;
  candidateNames: Record<string, string>;
};

type DignityFilter = Dignity | 'todas';
type StatusFilter = ActaStatus | 'todos';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'guardado', label: 'Guardados' },
  { value: 'fallado', label: 'Fallidos' },
];

export default function RevisionActasScreen() {
  const { actorId, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const [data, setData] = useState<ReviewData | null>(null);
  const [dignityFilter, setDignityFilter] = useState<DignityFilter>('todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
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
        const progressResult = await dataContainer.useCases.getProgress({
          actorId: actorId as string,
        });
        if (!progressResult.ok) {
          throw new Error(progressResult.error.message);
        }
        const snapshotResult = await dataContainer.repositories.progress.getSnapshot({});
        if (!snapshotResult.ok) {
          throw new Error(snapshotResult.error.message);
        }
        const candidatesResult = await listAllCandidateOptions();
        if (!candidatesResult.ok) {
          throw new Error(candidatesResult.error.message);
        }

        const snapshot = snapshotResult.value;
        const allowedRecintoIds = new Set(
          progressResult.value.progress.porRecinto.map((item) => item.recintoId),
        );
        const mesas = snapshot.mesas.filter(
          (mesa) => mesa.recintoId !== undefined && allowedRecintoIds.has(mesa.recintoId),
        );
        const mesaIds = new Set(mesas.map((mesa) => mesa.id));
        const actas = snapshot.actas
          .filter((acta) => mesaIds.has(acta.mesaId))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

        if (active) {
          setData({
            actas,
            mesasById: new Map(mesas.map((mesa) => [mesa.id, mesa])),
            recintosById: new Map(
              snapshot.recintos
                .filter((recinto) => allowedRecintoIds.has(recinto.id))
                .map((recinto) => [recinto.id, recinto]),
            ),
            candidateNames: candidatesResult.value.reduce<Record<string, string>>(
              (names, candidate) => {
                names[candidate.id] = `${candidate.organizationLabel} · ${candidate.fullName}`;
                return names;
              },
              {},
            ),
          });
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : 'No fue posible cargar las actas.',
          );
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

  const filteredActas = (data?.actas ?? []).filter((acta) => {
    const matchesDignidad = dignityFilter === 'todas' || acta.dignidad === dignityFilter;
    const matchesEstado = statusFilter === 'todos' || acta.estado === statusFilter;
    return matchesDignidad && matchesEstado;
  });

  return (
    <Screen
      title="Revisión de actas"
      subtitle="Evidencia, ubicación y conteo de todas las actas"
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
        <StatusFeedback status="en_proceso" message="Cargando actas..." />
      ) : (
        <StatusFeedback
          status="guardado"
          message={`${filteredActas.length} de ${data?.actas.length ?? 0} actas visibles.`}
        />
      )}

      <SectionTitle title="Dignidad" subtitle="Filtro por tipo de acta." />
      <View style={styles.optionGrid}>
        <OptionButton
          label="Todas"
          selected={dignityFilter === 'todas'}
          onPress={() => setDignityFilter('todas')}
        />
        {DIGNITIES.map((dignidad) => (
          <OptionButton
            key={dignidad}
            label={DIGNITY_LABELS[dignidad]}
            selected={dignityFilter === dignidad}
            onPress={() => setDignityFilter(dignidad)}
          />
        ))}
      </View>

      <SectionTitle title="Estado" subtitle="Filtro por estado de sincronización." />
      <View style={styles.optionGrid}>
        {STATUS_FILTERS.map((filter) => (
          <OptionButton
            key={filter.value}
            label={filter.label}
            selected={statusFilter === filter.value}
            onPress={() => setStatusFilter(filter.value)}
          />
        ))}
      </View>

      {data ? (
        <ActaReviewList
          actas={filteredActas}
          mesasById={data.mesasById}
          recintosById={data.recintosById}
          candidateNames={data.candidateNames}
        />
      ) : null}
      {!loading && filteredActas.length === 0 ? (
        <StatusFeedback
          status="validacion"
          message="No hay actas que coincidan con los filtros seleccionados."
        />
      ) : null}
      <PrimaryButton label="Volver al panel" onPress={() => router.back()} tone="secondary" />
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
