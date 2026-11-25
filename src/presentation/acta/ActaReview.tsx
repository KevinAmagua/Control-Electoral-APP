import { lazy, Suspense, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { getActaPhotoUri } from '@/data/remote/supabase/storage-repository';
import type { Acta } from '@/domain/acta/acta';
import { DIGNITY_LABELS } from '@/domain/election/dignity';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
import { PrimaryButton, StatusFeedback } from '@/presentation/components';

import { distanceBetweenCoordinates, formatCoordinate, formatDateTime } from './geo';
import { InfoRow, StatusChip } from './ui';

const NativeActaMap =
  Platform.OS === 'web'
    ? null
    : lazy(() => import('./ActaMap').then((module) => ({ default: module.ActaMap })));

type ActaReviewCardProps = {
  acta: Acta;
  mesa?: Mesa;
  recinto?: Recinto;
  candidateNames?: Record<string, string>;
  onCorrect?: (acta: Acta) => void;
};

export function ActaReviewCard({
  acta,
  mesa,
  recinto,
  candidateNames,
  onCorrect,
}: ActaReviewCardProps) {
  const [photo, setPhoto] = useState<{ path: string; uri: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    if (!acta.fotoPath) {
      return;
    }

    void getActaPhotoUri(acta.fotoPath).then((result) => {
      if (active) {
        setPhoto({
          path: acta.fotoPath,
          uri: result.ok && result.value.length > 0 ? result.value : null,
        });
      }
    });

    return () => {
      active = false;
    };
  }, [acta.fotoPath]);

  const photoUri = !acta.fotoPath ? null : photo?.path === acta.fotoPath ? photo.uri : null;

  const distance =
    recinto &&
    Number.isFinite(acta.gpsLat) &&
    Number.isFinite(acta.gpsLng) &&
    Number.isFinite(recinto.gpsLat) &&
    Number.isFinite(recinto.gpsLng)
      ? distanceBetweenCoordinates(
          acta.gpsLat,
          acta.gpsLng,
          recinto.gpsLat,
          recinto.gpsLng,
        )
      : null;
  const radiusLimit = recinto && recinto.radiusMeters > 0 ? recinto.radiusMeters : 300;
  const outsideRadius = distance !== null && distance > radiusLimit;
  const hasCoordinates =
    Number.isFinite(acta.gpsLat) &&
    Number.isFinite(acta.gpsLng) &&
    recinto !== undefined &&
    Number.isFinite(recinto.gpsLat) &&
    Number.isFinite(recinto.gpsLng);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            Mesa {mesa?.number ?? '—'} · {DIGNITY_LABELS[acta.dignidad]}
          </Text>
          <Text style={styles.subtitle}>Versión {acta.version}</Text>
        </View>
        <StatusChip status={acta.estado} />
      </View>

      <Image
        source={photoUri ? { uri: photoUri } : undefined}
        style={styles.photo}
        resizeMode="cover"
      />

      {NativeActaMap && hasCoordinates && recinto ? (
        <Suspense
          fallback={
            <View style={styles.mapFallback}>
              <Text style={styles.subtitle}>Cargando mapa...</Text>
            </View>
          }>
          <NativeActaMap
            actaLat={acta.gpsLat}
            actaLng={acta.gpsLng}
            recintoLat={recinto.gpsLat}
            recintoLng={recinto.gpsLng}
            radiusMeters={radiusLimit}
            outsideRadius={outsideRadius}
            actaLabel={`Acta · ${formatCoordinate(acta.gpsLat)}, ${formatCoordinate(acta.gpsLng)}`}
            recintoLabel={`Recinto ${recinto.name}`}
          />
        </Suspense>
      ) : (
        <View style={styles.mapFallback}>
          <Text style={styles.subtitle}>
            {Platform.OS === 'web'
              ? 'Mapa disponible solo en la aplicación móvil.'
              : 'Coordenadas insuficientes para mostrar el mapa.'}
          </Text>
          <Text style={styles.subtitle}>
            Acta: {formatCoordinate(acta.gpsLat)}, {formatCoordinate(acta.gpsLng)}
          </Text>
          {recinto ? (
            <Text style={styles.subtitle}>
              Recinto: {formatCoordinate(recinto.gpsLat)}, {formatCoordinate(recinto.gpsLng)}
            </Text>
          ) : null}
        </View>
      )}

      {outsideRadius ? (
        <StatusFeedback
          status="validacion"
          message={`La captura está a ${distance} m del recinto (límite ${radiusLimit} m). Verifique la ubicación.`}
        />
      ) : null}

      <View style={styles.details}>
        <InfoRow label="Ubicación del acta" value={
          <Text style={styles.value}>
            {formatCoordinate(acta.gpsLat)}, {formatCoordinate(acta.gpsLng)}
          </Text>
        } />
        <InfoRow label="Precisión GPS" value={
          <Text style={styles.value}>{Math.round(acta.gpsPrecision)} m</Text>
        } />
        {distance !== null ? (
          <InfoRow label="Distancia al recinto" value={
            <Text style={[styles.value, outsideRadius && styles.alert]}>
              {distance} m / {radiusLimit} m
            </Text>
          } />
        ) : null}
        <InfoRow label="Sufragantes" value={
          <Text style={styles.value}>
            {acta.totalSufragantes} · válidos {acta.votosValidos} · blancos {acta.votosBlancos} · nulos{' '}
            {acta.votosNulos}
          </Text>
        } />
        <InfoRow label="Actualizado" value={
          <Text style={styles.value}>{formatDateTime(acta.updatedAt)}</Text>
        } />
      </View>

      {acta.votos.length > 0 ? (
        <View style={styles.votes}>
          <Text style={styles.votesTitle}>Votos por lista</Text>
          {acta.votos.map((voto) => (
            <InfoRow
              key={`${acta.id}-${voto.candidateId}`}
              label={candidateNames?.[voto.candidateId] ?? voto.organizationId}
              value={<Text style={styles.value}>{voto.votos}</Text>}
            />
          ))}
        </View>
      ) : null}

      {onCorrect ? (
        <PrimaryButton
          compact
          label="Corregir acta"
          tone="secondary"
          onPress={() => onCorrect(acta)}
        />
      ) : null}
    </View>
  );
}

export function ActaReviewList({
  actas,
  mesasById,
  recintosById,
  candidateNames,
  onCorrect,
}: {
  actas: readonly Acta[];
  mesasById: Map<string, Mesa>;
  recintosById: Map<string, Recinto>;
  candidateNames?: Record<string, string>;
  onCorrect?: (acta: Acta) => void;
}) {
  return (
    <>
      {actas.map((acta) => {
        const mesa = mesasById.get(acta.mesaId);
        const recinto = mesa?.recintoId ? recintosById.get(mesa.recintoId) : undefined;
        return (
          <ActaReviewCard
            key={acta.id}
            acta={acta}
            mesa={mesa}
            recinto={recinto}
            candidateNames={candidateNames}
            onCorrect={onCorrect}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: palette.border,
  },
  mapFallback: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
  },
  details: {
    gap: spacing.sm,
  },
  value: {
    color: palette.text,
    fontSize: typography.caption,
    fontWeight: '600',
    textAlign: 'right',
  },
  alert: {
    color: palette.danger,
  },
  votes: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  votesTitle: {
    color: palette.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
});
