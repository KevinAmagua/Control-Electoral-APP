import { failure, type Result } from '../../core/result/result';
import type { Assignment } from '../election/assignment';
import type { CreateUserInput, UserProfile } from '../user/profile';
import type { AssignmentContextDependencies } from './assignment-context';
import { loadAssignmentContext as loadContext } from './assignment-context';
import { createAccountUseCase } from './create-account';

export type QuickVeedorInput = Omit<CreateUserInput, 'role' | 'recintoId'>;

export type ReplaceVeedorInput = {
  actorId: string;
  mesaIds: string[];
  previousVeedorId: string;
  nextVeedorId?: string;
  newVeedor?: QuickVeedorInput;
  reason: string;
};

export function createReplaceVeedorUseCase(dependencies: AssignmentContextDependencies) {
  return async (input: ReplaceVeedorInput): Promise<Result<Assignment[]>> => {
    const contextResult = await loadContext(dependencies, input.actorId, input.mesaIds);
    if (!contextResult.ok) {
      return contextResult;
    }
    const { actor } = contextResult.value;

    if (input.reason.trim().length === 0) {
      return failure('MOTIVO_REQUERIDO', 'Indique el motivo del reemplazo');
    }
    if (input.nextVeedorId === input.previousVeedorId) {
      return failure('VEEDOR_IGUAL', 'El veedor sustituto debe ser distinto');
    }

    let nextVeedor: UserProfile | null = null;
    if (input.nextVeedorId) {
      const nextResult = await dependencies.users.getById(input.nextVeedorId);
      if (!nextResult.ok) {
        return nextResult;
      }
      nextVeedor = nextResult.value;
    } else if (input.newVeedor) {
      const created = await createAccountUseCase(dependencies.users)({
        ...input.newVeedor,
        role: 'veedor',
        recintoId: actor.recintoId,
        createdBy: actor.id,
      });
      if (!created.ok) {
        return created;
      }
      nextVeedor = created.value;
    } else {
      return failure('SUSTITUTO_REQUERIDO', 'Seleccione un veedor o registre uno nuevo');
    }

    if (
      !nextVeedor ||
      nextVeedor.role !== 'veedor' ||
      !nextVeedor.active ||
      nextVeedor.recintoId !== actor.recintoId
    ) {
      return failure('VEEDOR_INVALIDO', 'El sustituto debe ser un veedor activo de su recinto');
    }

    for (const mesa of contextResult.value.mesas) {
      const activeResult = await dependencies.assignments.getActiveByMesa(mesa.id);
      if (!activeResult.ok) {
        return activeResult;
      }
      const active = activeResult.value;
      if (!active || active.veedorId !== input.previousVeedorId) {
        return failure('ASIGNACION_PREVIA_NO_ENCONTRADA', `La mesa ${mesa.number} no está asignada al veedor indicado`);
      }
    }

    return dependencies.assignments.replace({
      mesaIds: input.mesaIds,
      previousVeedorId: input.previousVeedorId,
      nextVeedorId: nextVeedor.id,
      reason: input.reason,
      assignedBy: actor.id,
    });
  };
}
