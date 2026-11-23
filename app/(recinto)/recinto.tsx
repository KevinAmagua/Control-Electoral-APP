import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { getMesaProgress } from '@/domain/acta/progress';
import type { Acta } from '@/domain/acta/acta';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
import { fullName } from '@/domain/user/profile';
import { InfoRow, SectionTitle, StatusChip, type DisplayStatus } from '@/presentation/acta/ui';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { formatCoordinate } from '@/presentation/acta/geo';
import { PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';

type MesaRow = {
  mesa: Mesa;
  veedorName: string;
  actas: Acta[];
};

function toDisplayStatus(status: ReturnType<typeof getMesaProgress>['status']): DisplayStatus {
  if (status === 'completa') {
    return 'guardado';
  }
  if (status === 'parcial') {
    return 'en_proceso';
  }
  return null;
}

export default function RecintoScreen() {
  const { session, profile, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const [recinto, setRecinto] = useState<Recinto | null>(null);
  const [rows, setRows] = useState<MesaRow[]>([]);
  const [pendingConflicts, setPendingConflicts] = useState(0);
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
        const { territory, assignments, users, actas } = dataContainer.repositories;
        const [recintoResult, mesasResult, usersResult, actasResult, conflictsResult] =
          await Promise.all([
            territory.getRecinto(recintoId),
            territory.listMesas(recintoId),
            users.listByRecinto(recintoId),
            actas.listByRecinto(recintoId),
            actas.listConflicts(recintoId),
          ]);

        if (!recintoResult.ok) throw new Error(recintoResult.error.message);
        if (!mesasResult.ok) throw new Error(mesasResult.error.message);
        if (!usersResult.ok) throw new Error(usersResult.error.message);
        if (!actasResult.ok) throw new Error(actasResult.error.message);
        if (!conflictsResult.ok) throw new Error(conflictsResult.error.message);

        const assignmentResults = await Promise.all(
          mesasResult.value.map((mesa) => assignments.getActiveByMesa(mesa.id)),
        );
        const usersById = new Map(usersResult.value.map((user) => [user.id, user]));
        const nextRows: MesaRow[] = mesasResult.value.map((mesa, index) => {
          const assignment = assignmentResults[index];
          const assignmentValue = assignment.ok ? assignment.value : null;
          const assignedUser = assignmentValue ? usersById.get(assignmentValue.veedorId) : undefined;
          return {
            mesa,
            veedorName: assignedUser ? fullName(assignedUser) : 'Sin veedor asignado',
            actas: actasResult.value.filter((acta) => acta.mesaId === mesa.id),
          };
        });
        const mesaIds = new Set(mesasResult.value.map((mesa) => mesa.id));
        const pending = conflictsResult.value.filter(
          (conflict) =>
            (conflict.status === 'detectado' || conflict.status === 'en_revision') &&
            mesaIds.has(conflict.mesaId),
        );

        if (active) {
          setRecinto(recintoResult.value);
          setRows(nextRows);
          setPendingConflicts(pending.length);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'No fue posible cargar el recinto.');
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

  async function handleSignOut() {
    await session.signOut();
    router.replace('/login');
  }

  return (
    <Screen
      title="Recinto de votación"
      subtitle={recinto ? `${recinto.code} · ${recinto.name}` : 'Coordinación de recinto'}
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
        <StatusFeedback status="en_proceso" message="Consultando recinto, mesas y asignaciones..." />
      ) : (
        <StatusFeedback
          status={pendingConflicts > 0 ? 'validacion' : 'guardado'}
          message={
            pendingConflicts > 0
              ? `${pendingConflicts} conflictos pendientes de revisión.`
              : `${rows.length} mesas del recinto cargadas correctamente.`
          }
        />
      )}

      {recinto ? (
        <View style={styles.card}>
          <SectionTitle title="Datos del recinto" subtitle={recinto.address} />
          <InfoRow label="Parroquia" value={<Text style={styles.value}>{recinto.parish ?? '—'}</Text>} />
          <InfoRow
            label="Coordenadas"
            value={
              <Text style={styles.value}>
                {formatCoordinate(recinto.gpsLat)}, {formatCoordinate(recinto.gpsLng)}
              </Text>
            }
          />
          <InfoRow
            label="Radio GPS"
            value={<Text style={styles.value}>{recinto.radiusMeters} m</Text>}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton label="Asignar veedores" onPress={() => router.push('/asignar-veedores')} />
        <PrimaryButton
          label={`Conflictos pendientes (${pendingConflicts})`}
          onPress={() => router.push('/conflictos')}
          disabled={pendingConflicts === 0}
          tone={pendingConflicts > 0 ? 'accent' : 'secondary'}
        />
        <PrimaryButton
          label="Revisar actas"
          onPress={() => router.push('/revision-acta')}
          tone="secondary"
        />
      </View>

      <SectionTitle title="Mesas y asignaciones" subtitle="Datos reales del recinto." />
      {rows.map((row) => (
        <Pressable
          key={row.mesa.id}
          accessibilityRole="button"
          style={styles.mesaCard}
          onPress={() => router.push('/asignar-veedores')}>
          <View style={styles.mesaHeader}>
            <Text style={styles.mesaNumber}>Mesa {row.mesa.number}</Text>
            <StatusChip status={toDisplayStatus(getMesaProgress(row.mesa, row.actas).status)} />
          </View>
          <Text style={styles.location}>{row.mesa.location}</Text>
          <Text style={styles.detail}>Veedor: {row.veedorName}</Text>
          <Text style={styles.detail}>{row.mesa.registeredVoters} electores registrados</Text>
        </Pressable>
      ))}

      <PrimaryButton label="Cerrar sesión" onPress={handleSignOut} tone="secondary" />
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
  value: {
    color: palette.text,
    fontSize: typography.caption,
    fontWeight: '600',
    textAlign: 'right',
  },
  actions: {
    gap: spacing.sm,
  },
  mesaCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  mesaHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mesaNumber: {
    flex: 1,
    minWidth: 0,
    color: palette.primary,
    fontSize: typography.label,
    fontWeight: '700',
  },
  location: {
    color: palette.text,
    fontSize: typography.caption,
  },
  detail: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
});
