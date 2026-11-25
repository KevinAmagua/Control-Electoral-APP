import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { dataContainer } from '@/data/container';
import type { Acta } from '@/domain/acta/acta';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
import type { ProgressReport } from '@/domain/usecases/get-progress';
import { listAllCandidateOptions } from '@/presentation/acta/candidates';

export type DashboardData = {
  report: ProgressReport;
  actas: Acta[];
  mesasById: Map<string, Mesa>;
  recintosById: Map<string, Recinto>;
  candidateNames: Record<string, string>;
};

async function loadDashboard(actorId: string): Promise<DashboardData> {
  const progressResult = await dataContainer.useCases.getProgress({ actorId });
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

  return {
    report: progressResult.value,
    actas,
    mesasById: new Map(mesas.map((mesa) => [mesa.id, mesa])),
    recintosById: new Map(
      snapshot.recintos
        .filter((recinto) => allowedRecintoIds.has(recinto.id))
        .map((recinto) => [recinto.id, recinto]),
    ),
    candidateNames: candidatesResult.value.reduce<Record<string, string>>((names, candidate) => {
      names[candidate.id] = `${candidate.organizationLabel} · ${candidate.fullName}`;
      return names;
    }, {}),
  };
}

export function useProgressDashboard(actorId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!actorId) {
      return;
    }

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', actorId] });
    };
    const unsubscribeActas = dataContainer.repositories.actas.subscribeToActas(invalidate);
    const unsubscribeProgress =
      dataContainer.repositories.progress.subscribeToProgress(invalidate);
    const unsubscribeAssignments =
      dataContainer.repositories.assignments.subscribeToAssignments(invalidate);

    return () => {
      unsubscribeActas();
      unsubscribeProgress();
      unsubscribeAssignments();
    };
  }, [actorId, queryClient]);

  return useQuery({
    queryKey: ['dashboard', actorId],
    queryFn: () => loadDashboard(actorId as string),
    enabled: Boolean(actorId),
    staleTime: 10_000,
  });
}
