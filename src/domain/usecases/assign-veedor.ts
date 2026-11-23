import { failure, type Result } from '../../core/result/result';
import type { Assignment } from '../election/assignment';
import type { AssignmentContextDependencies } from './assignment-context';
import { loadAssignmentContext as loadContext } from './assignment-context';

export type AssignVeedorInput = {
  actorId: string;
  veedorId: string;
  mesaIds: string[];
  reason?: string;
};

export function createAssignVeedorUseCase(dependencies: AssignmentContextDependencies) {
  return async (input: AssignVeedorInput): Promise<Result<Assignment[]>> => {
    const contextResult = await loadContext(dependencies, input.actorId, input.mesaIds);
    if (!contextResult.ok) {
      return contextResult;
    }
    const { actor } = contextResult.value;

    const veedorResult = await dependencies.users.getById(input.veedorId);
    if (!veedorResult.ok) {
      return veedorResult;
    }
    const veedor = veedorResult.value;
    if (!veedor || veedor.role !== 'veedor' || !veedor.active || veedor.recintoId !== actor.recintoId) {
      return failure('VEEDOR_INVALIDO', 'El veedor debe estar activo y pertenecer a su recinto');
    }

    for (const mesa of contextResult.value.mesas) {
      const activeResult = await dependencies.assignments.getActiveByMesa(mesa.id);
      if (!activeResult.ok) {
        return activeResult;
      }
      if (activeResult.value) {
        return failure('MESA_YA_ASIGNADA', `La mesa ${mesa.number} ya tiene un veedor activo`);
      }
    }

    return dependencies.assignments.assignMany({
      mesaIds: contextResult.value.mesas.map((mesa) => mesa.id),
      veedorId: veedor.id,
      assignedBy: actor.id,
      reason: input.reason ?? null,
    });
  };
}
