import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/core/theme';
import { captureError } from '@/data/monitoring/sentry';
import { queueActaForSync } from '@/data/sync/outbox-manager';
import type { Acta, ActaDraft, VoteDetail } from '@/domain/acta/acta';
import { DIGNITY_LABELS } from '@/domain/election/dignity';
import {
  actaFormSchema,
  parseActaCount,
  validateActaDraft,
} from '@/domain/validation/acta';
import type { CandidateOption } from '@/presentation/acta/candidates';
import {
  LargeTextInput,
  PrimaryButton,
  StatusFeedback,
  type FeedbackStatus,
} from '@/presentation/components';

import { listLocalActaOperations } from './outbox-status';
import { useOutboxSync } from './useOutboxSync';
import { InfoRow, SectionTitle } from './ui';

type ActaCorrectionFormProps = {
  acta: Acta;
  candidates: readonly CandidateOption[];
  onDone: (message: string, status: FeedbackStatus) => void;
  onCancel: () => void;
};

type Feedback = { status: FeedbackStatus; message: string };

function createUuid(): string {
  const cryptoRef = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x03) | 0x08;
    return value.toString(16);
  });
}

function initialVotes(acta: Acta, candidates: readonly CandidateOption[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const candidate of candidates) {
    const detail = acta.votos.find((item) => item.candidateId === candidate.id);
    values[candidate.id] = String(detail?.votos ?? 0);
  }
  return values;
}

export function ActaCorrectionForm({
  acta,
  candidates,
  onDone,
  onCancel,
}: ActaCorrectionFormProps) {
  const dignityCandidates = candidates.filter((candidate) => candidate.dignidad === acta.dignidad);
  const [totalSufragantes, setTotalSufragantes] = useState(String(acta.totalSufragantes));
  const [votosBlancos, setVotosBlancos] = useState(String(acta.votosBlancos));
  const [votosNulos, setVotosNulos] = useState(String(acta.votosNulos));
  const [observaciones, setObservaciones] = useState(acta.observaciones ?? '');
  const [votes, setVotes] = useState<Record<string, string>>(() => initialVotes(acta, dignityCandidates));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);
  const { flush } = useOutboxSync();

  const formValidation = useMemo(
    () => actaFormSchema.safeParse({
      totalSufragantes,
      votosBlancos,
      votosNulos,
      votos: votes,
      observaciones,
    }),
    [observaciones, totalSufragantes, votes, votosBlancos, votosNulos],
  );
  const fieldErrors = useMemo<Record<string, string>>(() => {
    if (formValidation.success) {
      return {};
    }
    const errors: Record<string, string> = {};
    for (const issue of formValidation.error.issues) {
      const path = issue.path.join('.');
      if (path && !errors[path]) {
        errors[path] = issue.message;
      }
    }
    return errors;
  }, [formValidation]);

  async function handleSave() {
    const localOperations = await listLocalActaOperations();
    if (localOperations.ok) {
      const hasPending = localOperations.value.some(
        (operation) =>
          operation.actaId === acta.id &&
          (operation.status === 'pendiente' || operation.status === 'en_proceso'),
      );
      if (hasPending) {
        setFeedback({
          status: 'validacion',
          message: 'Esta acta ya tiene una operación pendiente. Revise su estado antes de corregirla de nuevo.',
        });
        return;
      }
    }

    const votos: VoteDetail[] = dignityCandidates.map((candidate) => ({
      organizationId: candidate.organizationId,
      candidateId: candidate.id,
      votos: parseActaCount(votes[candidate.id] ?? '0'),
    }));
    const draft: ActaDraft = {
      mesaId: acta.mesaId,
      dignidad: acta.dignidad,
      expectedVersion: acta.version,
      totalSufragantes: parseActaCount(totalSufragantes),
      votosValidos: votos.reduce((total, detail) => total + detail.votos, 0),
      votosBlancos: parseActaCount(votosBlancos),
      votosNulos: parseActaCount(votosNulos),
      gpsLat: acta.gpsLat,
      gpsLng: acta.gpsLng,
      gpsPrecision: acta.gpsPrecision,
      fotoPath: acta.fotoPath,
      observaciones: observaciones.trim() || undefined,
      operacionClienteId: createUuid(),
      votos,
    };
    const validation = validateActaDraft(draft);
    if (!validation.ok) {
      setFeedback({ status: 'validacion', message: validation.error.message });
      return;
    }

    setSaving(true);
    setFeedback({ status: 'en_proceso', message: 'Guardando corrección...' });
    try {
      const queued = await queueActaForSync({
        operationId: validation.value.operacionClienteId,
        actaId: acta.id,
        mesaId: validation.value.mesaId,
        dignity: validation.value.dignidad,
        expectedVersion: validation.value.expectedVersion,
        totalSufragantes: validation.value.totalSufragantes,
        votosValidos: validation.value.votosValidos,
        votosBlancos: validation.value.votosBlancos,
        votosNulos: validation.value.votosNulos,
        gpsLat: validation.value.gpsLat,
        gpsLng: validation.value.gpsLng,
        gpsPrecision: validation.value.gpsPrecision,
        fotoPath: validation.value.fotoPath,
        observaciones: validation.value.observaciones,
        votes: validation.value.votos,
      });

      if (!queued.ok) {
        setFeedback({ status: 'fallado', message: queued.error.message });
        return;
      }

      const pendingMessage =
        'Corrección guardada localmente. Pendiente hasta que se recupere la conexión.';
      setFeedback({ status: 'guardado_local', message: pendingMessage });

      const synced = await flush();
      const updatedOperations = await listLocalActaOperations();
      const ownOperation = updatedOperations.ok
        ? updatedOperations.value.find((operation) => operation.operationId === queued.value)
        : null;
      const sentToServer = ownOperation?.status === 'guardado';
      const detail = !synced.ok
        ? synced.error.message
        : !updatedOperations.ok
          ? updatedOperations.error.message
          : null;
      const finalFeedback: Feedback = sentToServer
        ? { status: 'enviado', message: 'Corrección enviada.' }
        : {
            status: 'guardado_local',
            message: `${pendingMessage}${detail ? `. ${detail}` : ''}`,
          };

      setFeedback(finalFeedback);
      onDone(finalFeedback.message, finalFeedback.status);
    } catch (error) {
      captureError(error, { scope: 'acta.correction' });
      setFeedback({
        status: 'fallado',
        message: error instanceof Error ? error.message : 'No fue posible guardar la corrección.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <SectionTitle
        title={`Corregir acta · ${DIGNITY_LABELS[acta.dignidad]}`}
        subtitle={`Versión ${acta.version}. Se conservan la foto y la ubicación originales.`}
      />
      {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
      {!feedback && Object.keys(fieldErrors).length > 0 ? (
        <StatusFeedback status="validacion" message={Object.values(fieldErrors)[0] ?? ''} />
      ) : null}
      <InfoRow
        label="Foto original"
        value={<StatusFeedback status="guardado" message={acta.fotoPath ? 'Disponible' : 'Sin foto'} />}
      />
      <LargeTextInput
        label="Total de sufragantes"
        value={totalSufragantes}
        onChangeText={(value) => {
          setTotalSufragantes(value);
          setFeedback(null);
        }}
        error={fieldErrors.totalSufragantes}
        keyboardType="number-pad"
      />
      <LargeTextInput
        label="Votos en blanco"
        value={votosBlancos}
        onChangeText={(value) => {
          setVotosBlancos(value);
          setFeedback(null);
        }}
        error={fieldErrors.votosBlancos}
        keyboardType="number-pad"
      />
      <LargeTextInput
        label="Votos nulos"
        value={votosNulos}
        onChangeText={(value) => {
          setVotosNulos(value);
          setFeedback(null);
        }}
        error={fieldErrors.votosNulos}
        keyboardType="number-pad"
      />
      {dignityCandidates.map((candidate) => (
        <LargeTextInput
          key={candidate.id}
          label={`${candidate.organizationLabel} · ${candidate.fullName}`}
          value={votes[candidate.id] ?? '0'}
          onChangeText={(value) => {
            setVotes((current) => ({ ...current, [candidate.id]: value }));
            setFeedback(null);
          }}
          error={fieldErrors[`votos.${candidate.id}`]}
          keyboardType="number-pad"
        />
      ))}
      <LargeTextInput
        label="Observaciones"
        value={observaciones}
        onChangeText={(value) => {
          setObservaciones(value);
          setFeedback(null);
        }}
        multiline
      />
      <View style={styles.actions}>
        <PrimaryButton
          compact
          label="Guardar corrección"
          onPress={handleSave}
          isLoading={saving}
          disabled={saving}
        />
        <PrimaryButton compact label="Cancelar" onPress={onCancel} tone="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: spacing.md,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
