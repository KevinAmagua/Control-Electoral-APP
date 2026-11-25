import { useCallback, useEffect, useState } from 'react';

import { dataContainer } from '@/data/container';
import type { Acta } from '@/domain/acta/acta';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
import { ActaCorrectionForm } from '@/presentation/acta/ActaCorrectionForm';
import { ActaReviewList } from '@/presentation/acta/ActaReview';
import { listAllCandidateOptions, type CandidateOption } from '@/presentation/acta/candidates';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { Screen, StatusFeedback, type FeedbackStatus } from '@/presentation/components';

export default function RevisionActaScreen() {
  const { actorId, profile, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const [recinto, setRecinto] = useState<Recinto | null>(null);
  const [mesasById, setMesasById] = useState<Map<string, Mesa>>(new Map());
  const [recintosById, setRecintosById] = useState<Map<string, Recinto>>(new Map());
  const [actas, setActas] = useState<Acta[]>([]);
  const [candidateOptions, setCandidateOptions] = useState<CandidateOption[]>([]);
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  const [selectedActa, setSelectedActa] = useState<Acta | null>(null);
  const [correctionFeedback, setCorrectionFeedback] = useState<{
    status: FeedbackStatus;
    message: string;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        const { territory, actas: actasRepository } = dataContainer.repositories;
        const recintoResult = await territory.getRecinto(recintoId);
        const mesasResult = await territory.listMesas(recintoId);
        const actasResult = await actasRepository.listByRecinto(recintoId);
        const candidatesResult = await listAllCandidateOptions();
        if (!recintoResult.ok) throw new Error(recintoResult.error.message);
        if (!mesasResult.ok) throw new Error(mesasResult.error.message);
        if (!actasResult.ok) throw new Error(actasResult.error.message);
        if (!candidatesResult.ok) throw new Error(candidatesResult.error.message);

        if (active) {
          setRecinto(recintoResult.value);
          setMesasById(new Map(mesasResult.value.map((mesa) => [mesa.id, mesa])));
          setRecintosById(
            recintoResult.value ? new Map([[recintoResult.value.id, recintoResult.value]]) : new Map(),
          );
          setActas(actasResult.value);
          setCandidateOptions(candidatesResult.value);
          setCandidateNames(
            candidatesResult.value.reduce<Record<string, string>>((names, candidate) => {
              names[candidate.id] = `${candidate.organizationLabel} · ${candidate.fullName}`;
              return names;
            }, {}),
          );
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'No fue posible revisar las actas.');
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

  return (
    <Screen
      title="Revisión de actas"
      subtitle={recinto ? `${recinto.code} · ${recinto.name}` : 'Evidencia capturada por los veedores'}>
      {actorError || loadError ? (
        <StatusFeedback status="fallado" message={actorError ?? loadError ?? undefined} />
      ) : null}
      {loading || isActorLoading ? (
        <StatusFeedback status="en_proceso" message="Cargando actas y evidencia..." />
      ) : (
        <StatusFeedback
          status="guardado"
          message={
            actas.length === 0
              ? 'Aún no hay actas registradas en el recinto.'
              : `${actas.length} actas disponibles para revisión.`
          }
        />
      )}
      {correctionFeedback ? (
        <StatusFeedback status={correctionFeedback.status} message={correctionFeedback.message} />
      ) : null}
      {selectedActa && actorId ? (
        <ActaCorrectionForm
          acta={selectedActa}
          candidates={candidateOptions}
          onCancel={() => setSelectedActa(null)}
          onDone={(message, status) => {
            setCorrectionFeedback({ message, status });
            setSelectedActa(null);
            setReloadToken((value) => value + 1);
          }}
        />
      ) : null}
      <ActaReviewList
        actas={actas}
        mesasById={mesasById}
        recintosById={recintosById}
        candidateNames={candidateNames}
        onCorrect={(acta) => {
          setCorrectionFeedback(null);
          setSelectedActa(acta);
        }}
      />
    </Screen>
  );
}
