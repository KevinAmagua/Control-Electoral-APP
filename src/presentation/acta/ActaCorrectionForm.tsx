import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/core/theme';
import { dataContainer } from '@/data/container';
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

import { InfoRow, SectionTitle } from './ui';

type ActaCorrectionFormProps = {
  acta: Acta;
  actorId: string;
  candidates: readonly CandidateOption[];
  onDone: () => void;
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
  actorId,
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
    const result = await dataContainer.useCases.correctActa({
      ...validation.value,
      actorId,
      actaId: acta.id,
    });
    setSaving(false);

    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }
    setFeedback({
      status: 'guardado',
      message: `Acta corregida a la versión ${result.value.version}`,
    });
    onDone();
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
