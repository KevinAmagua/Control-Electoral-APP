import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import type { Acta } from '@/domain/acta/acta';
import type { VoteCount } from '@/domain/acta/progress';
import { DIGNITIES, DIGNITY_LABELS, type Dignity } from '@/domain/election/dignity';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
import type { ProgressReport } from '@/domain/usecases/get-progress';
import { ActaReviewCard } from '@/presentation/acta/ActaReview';
import { listAllCandidateOptions } from '@/presentation/acta/candidates';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { SectionTitle } from '@/presentation/acta/ui';
import { PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';

type DashboardData = {
  report: ProgressReport;
  actas: Acta[];
  mesasById: Map<string, Mesa>;
  recintosById: Map<string, Recinto>;
  candidateNames: Record<string, string>;
};

export default function DashboardScreen() {
  const { session, actorId, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const [data, setData] = useState<DashboardData | null>(null);
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
        const progressResult = await dataContainer.useCases.getProgress({ actorId: actorId as string });
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
            report: progressResult.value,
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
          setLoadError(error instanceof Error ? error.message : 'No fue posible cargar el panel.');
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

  async function handleSignOut() {
    await session.signOut();
    router.replace('/login');
  }

  const progress = data?.report.progress;
  const reportedPercent =
    progress && progress.totalMesas > 0
      ? Math.round((progress.mesasReportadas / progress.totalMesas) * 100)
      : 0;
  const voteGroups = new Map<Dignity, VoteCount[]>();
  for (const count of data?.report.voteCounts ?? []) {
    const group = voteGroups.get(count.dignidad) ?? [];
    group.push(count);
    voteGroups.set(count.dignidad, group);
  }

  return (
    <Screen
      title="Panel provincial"
      subtitle="Avance en tiempo real desde Supabase"
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
        <StatusFeedback status="en_proceso" message="Consultando el avance provincial..." />
      ) : (
        <StatusFeedback
          status="guardado"
          message={progress ? `Avance general: ${reportedPercent}% de las mesas reportadas.` : 'Sin datos.'}
        />
      )}

      {progress ? (
        <>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{progress.totalMesas}</Text>
              <Text style={styles.summaryLabel}>Mesas habilitadas</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{progress.mesasReportadas}</Text>
              <Text style={styles.summaryLabel}>Mesas reportadas</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{progress.mesasCompletas}</Text>
              <Text style={styles.summaryLabel}>Mesas completas</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{progress.mesasFaltantes}</Text>
              <Text style={styles.summaryLabel}>Mesas faltantes</Text>
            </View>
          </View>

          <SectionTitle
            title="Avance por recinto"
            subtitle={`${progress.mesasParciales} mesas con reporte parcial`}
          />
          {progress.porRecinto.map((recinto) => {
            const percent =
              recinto.totalMesas === 0
                ? 0
                : Math.round((recinto.mesasCompletas / recinto.totalMesas) * 100);
            return (
              <View key={recinto.recintoId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {recinto.code} · {recinto.name}
                  </Text>
                  <Text style={styles.cardValue}>{percent}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>
                <Text style={styles.cardDetail}>
                  {recinto.mesasCompletas} completas · {recinto.mesasParciales} parciales ·{' '}
                  {recinto.mesasFaltantes} faltantes de {recinto.totalMesas}
                </Text>
              </View>
            );
          })}

          <SectionTitle title="Conteo acumulado" subtitle="Votos de actas guardadas por dignidad." />
          {DIGNITIES.map((dignidad) => {
            const counts = (voteGroups.get(dignidad) ?? []).slice(0, 5);
            return (
              <View key={dignidad} style={styles.card}>
                <Text style={styles.cardTitle}>{DIGNITY_LABELS[dignidad]}</Text>
                {counts.length === 0 ? (
                  <Text style={styles.cardDetail}>Sin votos registrados.</Text>
                ) : (
                  counts.map((count) => (
                    <View key={`${count.organizationId}-${count.candidateId}`} style={styles.voteRow}>
                      <Text style={styles.cardDetail}>
                        {data?.candidateNames[count.candidateId] ?? count.organizationId}
                      </Text>
                      <Text style={styles.cardValue}>{count.votos}</Text>
                    </View>
                  ))
                )}
              </View>
            );
          })}

          <SectionTitle title="Ubicación de actas" subtitle="Evidencia georreferenciada capturada." />
          {data?.actas.length === 0 ? (
            <StatusFeedback status="validacion" message="Todavía no hay actas para revisar." />
          ) : (
            data?.actas.slice(0, 3).map((acta) => {
              const mesa = data.mesasById.get(acta.mesaId);
              const recinto = mesa?.recintoId
                ? data.recintosById.get(mesa.recintoId)
                : undefined;
              return (
                <ActaReviewCard
                  key={acta.id}
                  acta={acta}
                  mesa={mesa}
                  recinto={recinto}
                  candidateNames={data.candidateNames}
                />
              );
            })
          )}
          <PrimaryButton
            label="Revisar todas las actas"
            onPress={() => router.push('/revision-actas')}
          />
        </>
      ) : null}

      <PrimaryButton
        label="Gestionar recintos y coordinadores"
        onPress={() => router.push('/gestion-recintos')}
        tone="secondary"
      />
      <PrimaryButton label="Cerrar sesión" onPress={handleSignOut} tone="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  summaryValue: {
    color: palette.primary,
    fontSize: typography.title,
    fontWeight: '700',
  },
  summaryLabel: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  cardValue: {
    color: palette.primary,
    fontSize: typography.label,
    fontWeight: '700',
  },
  cardDetail: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
