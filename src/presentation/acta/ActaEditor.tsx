import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import type { Result } from '@/core/result/result';
import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { queueActaForSync } from '@/data/sync/outbox-manager';
import type { Acta, ActaDraft, VoteDetail } from '@/domain/acta/acta';
import { DIGNITIES, DIGNITY_LABELS, type Dignity } from '@/domain/election/dignity';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
import {
  actaFormSchema,
  parseActaCount,
  validateActaDraft,
  type ActaFormValues,
} from '@/domain/validation/acta';
import {
  LargeTextInput,
  PrimaryButton,
  Screen,
  StatusFeedback,
  type FeedbackStatus,
} from '@/presentation/components';
import {
  EvidenceCapture,
  type ConfirmedEvidence,
} from '@/presentation/evidence/EvidenceCapture';

import { listCandidateOptions, type CandidateOption } from './candidates';
import { listLocalActaOperations } from './outbox-status';
import { useActorProfile } from './session-actor';
import { InfoRow, OptionButton, SectionTitle, StatusChip } from './ui';
import { useOutboxSync } from './useOutboxSync';

type ActaEditorProps = {
  mesaId: string;
  initialDignidad: Dignity;
  onDone: () => void;
  onViewStatus: () => void;
};

type Feedback = { status: FeedbackStatus; message: string };

function createUuid(): string {
  const cryptoRef = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array }
    | undefined;

  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function emptyFormValues(): ActaFormValues {
  return {
    totalSufragantes: '',
    votosBlancos: '0',
    votosNulos: '0',
    votos: {},
    observaciones: '',
  };
}

function formValuesFromActa(acta: Acta | null, candidates: CandidateOption[]): ActaFormValues {
  const votos: Record<string, string> = {};
  for (const candidate of candidates) {
    const detail = acta?.votos.find((item) => item.candidateId === candidate.id);
    votos[candidate.id] = String(detail?.votos ?? 0);
  }
  return {
    totalSufragantes: acta ? String(acta.totalSufragantes) : '',
    votosBlancos: String(acta?.votosBlancos ?? 0),
    votosNulos: String(acta?.votosNulos ?? 0),
    votos,
    observaciones: acta?.observaciones ?? '',
  };
}

export function ActaEditor({
  mesaId,
  initialDignidad,
  onDone,
  onViewStatus,
}: ActaEditorProps) {
  const { actorId, profile, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const { flush, error: syncError } = useOutboxSync();

  const [dignidad, setDignidad] = useState<Dignity>(initialDignidad);
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [recinto, setRecinto] = useState<Recinto | null>(null);
  const [existingActa, setExistingActa] = useState<Acta | null>(null);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [assignmentAllowed, setAssignmentAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<ConfirmedEvidence | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [operationId, setOperationId] = useState(createUuid);
  const [localActaId, setLocalActaId] = useState(createUuid);
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [pendingOperationId, setPendingOperationId] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { isValid },
  } = useForm<ActaFormValues>({
    resolver: zodResolver(actaFormSchema),
    mode: 'onChange',
    defaultValues: emptyFormValues(),
  });

  const watchedVotes = useWatch({ control, name: 'votos' }) ?? {};
  const watchedTotal = useWatch({ control, name: 'totalSufragantes' });
  const watchedBlancos = useWatch({ control, name: 'votosBlancos' });
  const watchedNulos = useWatch({ control, name: 'votosNulos' });
  const votesSignature = JSON.stringify(watchedVotes);
  const votosValidos = Object.values(watchedVotes).reduce((total, raw) => {
    const parsed = parseActaCount(raw);
    return total + (Number.isSafeInteger(parsed) ? parsed : 0);
  }, 0);

  useEffect(() => {
    if (typeof watchedTotal !== 'string' || watchedTotal.trim().length === 0) {
      return;
    }
    void trigger('totalSufragantes');
  }, [votesSignature, watchedBlancos, watchedNulos, watchedTotal, trigger]);

  const fallbackRecintoId = profile?.recintoId ?? null;

  const resetEditorState = useCallback(() => {
    reset(emptyFormValues());
    void Promise.resolve().then(() => {
      setOperationId(createUuid());
      setLocalActaId(createUuid());
      setExpectedVersion(0);
      setPendingOperationId(null);
      setEvidence(null);
      setSaved(false);
    });
  }, [reset]);

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
    resetEditorState();
  }, [dignidad, mesaId, resetEditorState]);

  useEffect(() => {
    let active = true;

    if (!actorId) {
      finishLoading();
      return;
    }

    startLoading();

    async function load() {
      try {
        const { territory, assignments, actas } = dataContainer.repositories;
        const loadedMesa = unwrap(await territory.getMesa(mesaId));
        if (!loadedMesa) {
          throw new Error('La mesa no existe.');
        }
        const recintoId = loadedMesa.recintoId ?? fallbackRecintoId;
        if (!recintoId) {
          throw new Error('La mesa no tiene un recinto asociado.');
        }
        const loadedRecinto = unwrap(await territory.getRecinto(recintoId));
        if (!loadedRecinto) {
          throw new Error('El recinto de la mesa no existe.');
        }
        const loadedAssignments = unwrap(await assignments.listByMesa(mesaId));
        const allowed = loadedAssignments.some(
          (assignment) => assignment.active && !assignment.unassignedAt && assignment.veedorId === actorId,
        );
        if (!allowed) {
          throw new Error('No tiene una asignación activa sobre esta mesa.');
        }
        const loadedActa = unwrap(await actas.getByMesaAndDignidad(mesaId, dignidad));
        const localOperations = unwrap(await listLocalActaOperations());
        const localOperation = localOperations.find(
          (operation) => operation.mesaId === mesaId && operation.dignity === dignidad,
        );
        const loadedCandidates = unwrap(await listCandidateOptions(dignidad));

        if (!active) {
          return;
        }
        setMesa(loadedMesa);
        setRecinto(loadedRecinto);
        setExistingActa(loadedActa);
        setLocalActaId(localOperation?.actaId ?? loadedActa?.id ?? createUuid());
        setExpectedVersion(loadedActa?.version ?? localOperation?.version ?? 0);
        setPendingOperationId(
          localOperation && (localOperation.status === 'pendiente' || localOperation.status === 'en_proceso')
            ? localOperation.operationId
            : null,
        );
        setCandidates(loadedCandidates);
        setAssignmentAllowed(true);
        reset(formValuesFromActa(loadedActa, loadedCandidates));
      } catch (error) {
        if (active) {
          setAssignmentAllowed(false);
          setLoadError(error instanceof Error ? error.message : 'No fue posible cargar el acta.');
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
  }, [actorId, dignidad, fallbackRecintoId, finishLoading, mesaId, reset, startLoading]);

  function buildDraft(values: ActaFormValues): ActaDraft {
    const votos: VoteDetail[] = candidates.map((candidate) => ({
      organizationId: candidate.organizationId,
      candidateId: candidate.id,
      votos: parseActaCount(values.votos[candidate.id] ?? '0'),
    }));
    const votosValidosCalculados = votos.reduce((total, detail) => total + detail.votos, 0);
    const observaciones = values.observaciones?.trim();

    return {
      mesaId,
      dignidad,
      expectedVersion,
      totalSufragantes: parseActaCount(values.totalSufragantes),
      votosValidos: votosValidosCalculados,
      votosBlancos: parseActaCount(values.votosBlancos),
      votosNulos: parseActaCount(values.votosNulos),
      gpsLat: evidence?.gpsLat ?? 0,
      gpsLng: evidence?.gpsLng ?? 0,
      gpsPrecision: evidence?.gpsPrecision ?? 0,
      fotoPath: evidence?.fotoPath ?? '',
      observaciones: observaciones && observaciones.length > 0 ? observaciones : undefined,
      operacionClienteId: operationId,
      votos,
    };
  }

  const onValidate = handleSubmit(
    (values) => {
      const validation = validateActaDraft(buildDraft(values));
      setFeedback(
        validation.ok
          ? { status: 'guardado', message: 'El acta cumple las reglas de validación.' }
          : { status: 'validacion', message: validation.error.message },
      );
    },
    () => {
      setFeedback({
        status: 'validacion',
        message: 'Revise el conteo: use enteros no negativos y cuadre con el total de sufragantes.',
      });
    },
  );

  const onSave = handleSubmit(
    async (values) => {
      if (!evidence) {
        setFeedback({ status: 'validacion', message: 'Capture la fotografía del acta antes de guardar.' });
        return;
      }
      if (!assignmentAllowed) {
        setFeedback({ status: 'validacion', message: 'No tiene una asignación activa sobre esta mesa.' });
        return;
      }
      if (candidates.length === 0) {
        setFeedback({ status: 'validacion', message: 'No hay candidatos activos para esta dignidad.' });
        return;
      }
      if (pendingOperationId) {
        setFeedback({
          status: 'validacion',
          message: 'Esta acta ya tiene una operación pendiente. Revise su estado antes de guardar otra.',
        });
        return;
      }

      const validation = validateActaDraft(buildDraft(values));
      if (!validation.ok) {
        setFeedback({ status: 'validacion', message: validation.error.message });
        return;
      }

      setSaving(true);
      setFeedback({ status: 'en_proceso', message: 'Guardando el acta en el dispositivo...' });
      const draft = validation.value;
      const queued = await queueActaForSync({
        operationId: draft.operacionClienteId,
        actaId: existingActa?.id ?? localActaId,
        mesaId: draft.mesaId,
        dignity: draft.dignidad,
        expectedVersion: draft.expectedVersion,
        totalSufragantes: draft.totalSufragantes,
        votosValidos: draft.votosValidos,
        votosBlancos: draft.votosBlancos,
        votosNulos: draft.votosNulos,
        gpsLat: draft.gpsLat,
        gpsLng: draft.gpsLng,
        gpsPrecision: draft.gpsPrecision,
        fotoPath: draft.fotoPath,
        observaciones: draft.observaciones,
        votes: draft.votos,
      });

      if (!queued.ok) {
        setFeedback({ status: 'fallado', message: queued.error.message });
        setSaving(false);
        return;
      }

      setSaved(true);
      setFeedback({
        status: 'guardado_local',
        message: 'Guardado en el dispositivo. Sincronización pendiente',
      });
      const synced = await flush();
      const localOperations = await listLocalActaOperations();
      const ownOperation = localOperations.ok
        ? localOperations.value.find((operation) => operation.operationId === queued.value)
        : null;
      const sentToServer =
        ownOperation?.status === 'guardado' || (!localOperations.ok && synced.ok && synced.value > 0);

      if (sentToServer) {
        setFeedback({ status: 'enviado', message: 'Guardado y enviado al servidor' });
      } else {
        const detail = !synced.ok ? `. ${synced.error.message}` : '';
        setFeedback({
          status: 'guardado_local',
          message: `Guardado en el dispositivo. Sincronización pendiente${detail}`,
        });
      }
      setSaving(false);
    },
    () => {
      setFeedback({
        status: 'validacion',
        message: 'Revise el conteo: use enteros no negativos y cuadre con el total de sufragantes.',
      });
    },
  );

  const isBusy = loading || isActorLoading || saving;
  const radiusLimit = recinto && recinto.radiusMeters > 0 ? recinto.radiusMeters : 300;
  const showEvidenceAlert =
    evidence?.outsideRadius === true || (evidence?.distanceMeters ?? 0) > radiusLimit;
  const progressSteps = [
    { label: 'Dignidad', complete: Boolean(dignidad) },
    { label: 'Evidencia', complete: Boolean(evidence) },
    { label: 'Conteo', complete: isValid },
    { label: 'Guardado', complete: saved },
  ];
  const completedSteps = progressSteps.filter((step) => step.complete).length;

  return (
    <Screen
      title={existingActa ? 'Corregir acta' : 'Registrar acta'}
      subtitle={
        mesa
          ? `Mesa ${mesa.number} · ${recinto?.name ?? 'Recinto'}`
          : 'Cargando mesa asignada...'
      }>
      {actorError || loadError ? (
        <StatusFeedback status="fallado" message={actorError ?? loadError ?? undefined} />
      ) : null}
      {isBusy ? (
        <StatusFeedback status="en_proceso" message="Preparando el formulario del acta..." />
      ) : null}
      {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
      {pendingOperationId ? (
        <StatusFeedback
          status="validacion"
          message={`Operación pendiente en el dispositivo: ${pendingOperationId}`}
        />
      ) : null}
      {syncError ? (
        <StatusFeedback status="fallado" message={`Sincronización: ${syncError}`} />
      ) : null}
      {mesa ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Progreso del acta: ${completedSteps} de ${progressSteps.length} pasos`}
          accessibilityValue={{ min: 0, max: progressSteps.length, now: completedSteps }}
          style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Progreso del acta</Text>
            <Text style={styles.progressCount}>
              {completedSteps} de {progressSteps.length}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completedSteps / progressSteps.length) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.progressSteps}>
            {progressSteps.map((step, index) => (
              <Text
                key={step.label}
                style={[styles.progressStep, step.complete && styles.progressStepComplete]}>
                {index + 1}. {step.label}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {mesa ? (
        <View style={styles.card}>
          <InfoRow label="Recinto" value={<Text style={styles.value}>{recinto?.name ?? '—'}</Text>} />
          <InfoRow label="Ubicación" value={<Text style={styles.value}>{mesa.location}</Text>} />
          <InfoRow
            label="Electores"
            value={<Text style={styles.value}>{mesa.registeredVoters}</Text>}
          />
          <InfoRow
            label="Estado previo"
            value={<StatusChip status={existingActa?.estado ?? null} />}
          />
        </View>
      ) : null}

      <SectionTitle title="Paso 1 · Dignidad" subtitle="Seleccione el acta que desea registrar." />
      <View style={styles.row}>
        {DIGNITIES.map((item) => (
          <OptionButton
            key={item}
            label={DIGNITY_LABELS[item]}
            selected={item === dignidad}
            disabled={isBusy || saved}
            onPress={() => {
              setDignidad(item);
              setFeedback(null);
            }}
          />
        ))}
      </View>

      {recinto && !saved ? (
        <View style={styles.evidenceSection}>
          <SectionTitle
            title="Paso 2 · Evidencia fotográfica"
            subtitle="La foto, la nitidez y la ubicación son obligatorias."
          />
          <EvidenceCapture
            recinto={recinto}
            onConfirm={(confirmed) => {
              setEvidence(confirmed);
              setFeedback(null);
            }}
          />
          {evidence ? (
            <View style={styles.card}>
              <InfoRow
                label="Nitidez"
                value={
                  <Text style={[styles.value, evidence.blurScore < 75 && styles.alert]}>
                    {evidence.blurScore}/100
                  </Text>
                }
              />
              <InfoRow
                label="Coordenadas"
                value={
                  <Text style={styles.value}>
                    {evidence.gpsLat.toFixed(6)}, {evidence.gpsLng.toFixed(6)}
                  </Text>
                }
              />
              <InfoRow
                label="Distancia"
                value={
                  <Text style={[styles.value, showEvidenceAlert && styles.alert]}>
                    {evidence.distanceMeters} m
                  </Text>
                }
              />
            </View>
          ) : null}
          {showEvidenceAlert ? (
            <StatusFeedback
              status="validacion"
              message={`La captura está a ${evidence?.distanceMeters} m del recinto (límite ${radiusLimit} m). Verifique la ubicación.`}
            />
          ) : null}
          {evidence && evidence.blurScore < 75 ? (
            <StatusFeedback
              status="validacion"
              message="La nitidez de la foto es baja. Repita la captura si el texto no es legible."
            />
          ) : null}
        </View>
      ) : null}
      {saved ? (
        <StatusFeedback
          status="guardado_local"
          message="El acta ya fue registrada. Revise su estado antes de iniciar otra operación."
        />
      ) : null}

      <SectionTitle title="Paso 3 · Conteo" subtitle="Ingrese los votos por lista, blancos y nulos." />
      {candidates.length === 0 && !isBusy ? (
        <StatusFeedback status="validacion" message="No hay candidatos activos para esta dignidad." />
      ) : null}
      {candidates.map((candidate) => (
        <Controller
          key={candidate.id}
          control={control}
          name={`votos.${candidate.id}` as FieldPath<ActaFormValues>}
          render={({ field, fieldState }) => (
            <LargeTextInput
              label={`${candidate.organizationLabel} · ${candidate.fullName}`}
              value={(field.value as string) ?? ''}
              onChangeText={field.onChange}
              error={fieldState.error?.message ?? null}
              keyboardType="number-pad"
              returnKeyType="next"
              editable={!isBusy && !saved}
            />
          )}
        />
      ))}
      <View style={styles.row}>
        <View style={styles.half}>
          <Controller
            control={control}
            name="votosBlancos"
            render={({ field, fieldState }) => (
              <LargeTextInput
                label="Votos blancos"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={fieldState.error?.message ?? null}
                keyboardType="number-pad"
                editable={!isBusy && !saved}
              />
            )}
          />
        </View>
        <View style={styles.half}>
          <Controller
            control={control}
            name="votosNulos"
            render={({ field, fieldState }) => (
              <LargeTextInput
                label="Votos nulos"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={fieldState.error?.message ?? null}
                keyboardType="number-pad"
                editable={!isBusy && !saved}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="totalSufragantes"
        render={({ field, fieldState }) => (
          <LargeTextInput
            label="Total sufragantes"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            error={fieldState.error?.message ?? null}
            keyboardType="number-pad"
            editable={!isBusy && !saved}
            hint="Ingrese el total del acta. No se calcula automáticamente."
          />
        )}
      />
      <View style={styles.card}>
        <InfoRow label="Votos válidos" value={<Text style={styles.value}>{votosValidos}</Text>} />
        <Text style={styles.hint}>
          La suma de listas, blancos y nulos debe coincidir con el total de sufragantes.
        </Text>
      </View>

      <Controller
        control={control}
        name="observaciones"
        render={({ field, fieldState }) => (
          <LargeTextInput
            label="Observaciones"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            error={fieldState.error?.message ?? null}
            multiline
            editable={!isBusy && !saved}
          />
        )}
      />

      <SectionTitle
        title="Paso 4 · Validar y guardar"
        subtitle="Revise el cuadre antes de registrar el acta."
      />
      <View style={styles.actions}>
        <PrimaryButton
          label="Validar acta"
          onPress={() => {
            void onValidate();
          }}
          disabled={isBusy || saved}
          tone="secondary"
        />
        <PrimaryButton
          label={existingActa ? 'Guardar corrección' : 'Guardar acta'}
          onPress={() => {
            void onSave();
          }}
          isLoading={saving}
          disabled={
            isBusy ||
            saved ||
            !isValid ||
            pendingOperationId !== null ||
            !evidence ||
            !assignmentAllowed ||
            candidates.length === 0
          }
        />
        <PrimaryButton label="Ver estados" onPress={onViewStatus} tone="secondary" />
        <PrimaryButton label="Volver a mesas" onPress={onDone} tone="secondary" />
      </View>
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
  progressCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressTitle: {
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  progressCount: {
    color: palette.primary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
  },
  progressSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  progressStep: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 70,
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  progressStepComplete: {
    color: palette.success,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
    minWidth: 112,
  },
  value: {
    color: palette.text,
    fontSize: typography.caption,
    fontWeight: '600',
    textAlign: 'right',
  },
  hint: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  alert: {
    color: palette.danger,
  },
  evidenceSection: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
});
