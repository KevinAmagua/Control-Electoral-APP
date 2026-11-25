import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import type { VoteCount } from '@/domain/acta/progress';
import { DIGNITIES, DIGNITY_LABELS, type Dignity } from '@/domain/election/dignity';
import { ActaReviewCard } from '@/presentation/acta/ActaReview';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { SectionTitle } from '@/presentation/acta/ui';
import { PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import { useProgressDashboard } from '@/presentation/query/useProgressDashboard';

export default function DashboardScreen() {
  const { actorId, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const {
    data,
    isPending,
    isFetching,
    error,
    refetch,
  } = useProgressDashboard(actorId);
  const isLoading = Boolean(actorId) && (isPending || isFetching);
  const loadError = error instanceof Error ? error.message : null;

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
      subtitle="Avance en tiempo real"
      action={
        <PrimaryButton
          label="Actualizar"
          onPress={() => void refetch()}
          disabled={isLoading}
          tone="secondary"
        />
      }>
      {actorError || loadError ? (
        <StatusFeedback status="fallado" message={actorError ?? loadError ?? undefined} />
      ) : null}
      {isActorLoading || isLoading ? (
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
            data?.actas.map((acta) => {
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
        </>
      ) : null}
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
