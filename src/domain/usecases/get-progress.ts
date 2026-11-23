import { failure, ok, type Result } from '../../core/result/result';
import { computeScrutinyProgress, computeVoteCounts, type ScrutinyProgress, type VoteCount } from '../acta/progress';
import type { ProgressRepository } from '../repositories/progress-repository';
import type { UserRepository } from '../repositories/user-repository';

export type ProgressReport = {
  progress: ScrutinyProgress;
  voteCounts: VoteCount[];
};

export type GetProgressInput = {
  actorId: string;
  recintoId?: string;
};

export function createGetProgressUseCase(
  progressRepository: ProgressRepository,
  users: UserRepository,
) {
  return async (input: GetProgressInput): Promise<Result<ProgressReport>> => {
    const actorResult = await users.getById(input.actorId);
    if (!actorResult.ok) {
      return actorResult;
    }
    const actor = actorResult.value;
    if (!actor || !actor.active || actor.role === 'veedor') {
      return failure('NO_AUTORIZADO', 'Solo los coordinadores pueden consultar el avance');
    }

    const snapshotResult = await progressRepository.getSnapshot({ recintoId: input.recintoId });
    if (!snapshotResult.ok) {
      return snapshotResult;
    }
    const snapshot = snapshotResult.value;

    const recintos = snapshot.recintos.filter((recinto) => {
      if (actor.role === 'coordinador_provincial') {
        return recinto.province === actor.province && recinto.canton === actor.canton;
      }
      return recinto.id === actor.recintoId;
    });
    const recintoIds = new Set(recintos.map((recinto) => recinto.id));
    const mesas = snapshot.mesas.filter((mesa) => mesa.recintoId && recintoIds.has(mesa.recintoId));
    const mesaIds = new Set(mesas.map((mesa) => mesa.id));
    const actas = snapshot.actas.filter((acta) => mesaIds.has(acta.mesaId));

    return ok({
      progress: computeScrutinyProgress(mesas, actas, recintos),
      voteCounts: computeVoteCounts(actas),
    });
  };
}
