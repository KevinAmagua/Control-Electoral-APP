import { failure, ok, type Result } from '../../core/result/result';
import type { Mesa } from '../election/mesa';
import type { Recinto } from '../election/recinto';
import type { AssignmentRepository } from '../repositories/assignment-repository';
import type { TerritoryRepository } from '../repositories/territory-repository';
import type { UserRepository } from '../repositories/user-repository';
import type { UserProfile } from '../user/profile';

export type AssignmentContext = {
  actor: UserProfile;
  recinto: Recinto;
  mesas: Mesa[];
};

export type AssignmentContextDependencies = {
  users: UserRepository;
  territory: TerritoryRepository;
  assignments: AssignmentRepository;
};

export async function loadAssignmentContext(
  dependencies: AssignmentContextDependencies,
  actorId: string,
  mesaIds: string[],
): Promise<Result<AssignmentContext>> {
  if (mesaIds.length === 0) {
    return failure('MESAS_REQUERIDAS', 'Seleccione al menos una mesa');
  }

  const actorResult = await dependencies.users.getById(actorId);
  if (!actorResult.ok) {
    return actorResult;
  }
  const actor = actorResult.value;
  if (!actor || !actor.active || actor.role !== 'coordinador_recinto' || !actor.recintoId) {
    return failure('NO_AUTORIZADO', 'Solo un coordinador de recinto activo puede asignar veedores');
  }

  const recintoResult = await dependencies.territory.getRecinto(actor.recintoId);
  if (!recintoResult.ok) {
    return recintoResult;
  }
  const recinto = recintoResult.value;
  if (!recinto) {
    return failure('RECINTO_NO_EXISTE', 'El recinto del coordinador no existe');
  }

  const mesasResult = await dependencies.territory.listMesas(recinto.id);
  if (!mesasResult.ok) {
    return mesasResult;
  }

  const selectedMesas: Mesa[] = [];
  for (const mesaId of mesaIds) {
    const mesa = mesasResult.value.find((candidate) => candidate.id === mesaId);
    if (!mesa) {
      return failure('MESA_NO_EXISTE', `La mesa ${mesaId} no pertenece a su recinto`);
    }
    if (mesa.recintoId !== recinto.id) {
      return failure('MESA_FUERA_DE_RECINTO', `La mesa ${mesa.number} no pertenece a su recinto`);
    }
    selectedMesas.push(mesa);
  }

  return ok({ actor, recinto, mesas: selectedMesas });
}
