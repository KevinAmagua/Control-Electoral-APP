import { failure, type Result } from '../../core/result/result';
import type { SyncConflict } from '../sync/operation';
import type { ActaContextDependencies } from './acta-context';

export type ResolveConflictInput = {
  actorId: string;
  conflictId: string;
  resolution: unknown;
};

export function createResolveConflictUseCase(dependencies: ActaContextDependencies) {
  return async (input: ResolveConflictInput): Promise<Result<SyncConflict>> => {
    const actorResult = await dependencies.users.getById(input.actorId);
    if (!actorResult.ok) {
      return actorResult;
    }
    const actor = actorResult.value;
    if (!actor || !actor.active || actor.role === 'veedor') {
      return failure('NO_AUTORIZADO', 'Solo un coordinador puede resolver conflictos');
    }
    if (input.resolution === undefined || input.resolution === null) {
      return failure('RESOLUCION_REQUERIDA', 'Indique qué versión prevalece');
    }

    const conflictsResult = await dependencies.actas.listConflicts();
    if (!conflictsResult.ok) {
      return conflictsResult;
    }
    const conflict = conflictsResult.value.find((item) => item.id === input.conflictId);
    if (!conflict) {
      return failure('CONFLICTO_NO_EXISTE', 'El conflicto no existe');
    }
    if (conflict.status !== 'detectado' && conflict.status !== 'en_revision') {
      return failure('CONFLICTO_YA_RESUELTO', 'El conflicto ya fue resuelto');
    }

    const mesaResult = await dependencies.territory.getMesa(conflict.mesaId);
    if (!mesaResult.ok) {
      return mesaResult;
    }
    const mesa = mesaResult.value;
    if (!mesa || !mesa.recintoId || mesa.recintoId !== actor.recintoId) {
      return failure('FUERA_DE_JURISDICCION', 'El conflicto no pertenece a su recinto');
    }

    return dependencies.actas.resolveConflict(conflict.id, input.resolution, actor.id);
  };
}
