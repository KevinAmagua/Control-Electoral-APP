import { failure, ok, type Result } from '../../core/result/result';
import type { Acta, ActaDraft } from '../acta/acta';
import type { Mesa } from '../election/mesa';
import type { Recinto } from '../election/recinto';
import type { AssignmentRepository } from '../repositories/assignment-repository';
import type { ActaRepository } from '../repositories/acta-repository';
import type { TerritoryRepository } from '../repositories/territory-repository';
import type { UserRepository } from '../repositories/user-repository';
import { canAccessMesa } from '../user/permissions';

export type ActaContextDependencies = {
  users: UserRepository;
  territory: TerritoryRepository;
  assignments: AssignmentRepository;
  actas: ActaRepository;
};

export type ActaContext = {
  actorId: string;
  mesa: Mesa;
  recinto: Recinto;
};

export async function loadActaContext(
  dependencies: ActaContextDependencies,
  actorId: string,
  mesaId: string,
): Promise<Result<ActaContext>> {
  const actorResult = await dependencies.users.getById(actorId);
  if (!actorResult.ok) {
    return actorResult;
  }
  const actor = actorResult.value;
  if (!actor || !actor.active) {
    return failure('NO_AUTORIZADO', 'El usuario no está activo');
  }

  const mesaResult = await dependencies.territory.getMesa(mesaId);
  if (!mesaResult.ok) {
    return mesaResult;
  }
  const mesa = mesaResult.value;
  if (!mesa || !mesa.recintoId) {
    return failure('MESA_NO_EXISTE', 'La mesa no existe');
  }

  const recintoResult = await dependencies.territory.getRecinto(mesa.recintoId);
  if (!recintoResult.ok) {
    return recintoResult;
  }
  const recinto = recintoResult.value;
  if (!recinto) {
    return failure('RECINTO_NO_EXISTE', 'El recinto de la mesa no existe');
  }

  const assignmentsResult = await dependencies.assignments.listByMesa(mesa.id);
  if (!assignmentsResult.ok) {
    return assignmentsResult;
  }
  if (!canAccessMesa(actor, mesa, recinto, assignmentsResult.value)) {
    return failure('SIN_PERMISO_PARA_LA_MESA', 'No tiene permiso sobre esta mesa');
  }

  return ok({ actorId: actor.id, mesa, recinto });
}

export async function handleVersionConflict(
  actas: ActaRepository,
  existing: Acta,
  draft: ActaDraft,
  actorId: string,
): Promise<Result<never>> {
  const recorded = await actas.recordConflict({
    id: draft.operacionClienteId,
    actaId: existing.id,
    mesaId: existing.mesaId,
    dignidad: existing.dignidad,
    baseVersion: draft.expectedVersion,
    localVersion: draft.expectedVersion + 1,
    remoteVersion: existing.version,
    detectedBy: actorId,
    payload: draft,
    status: 'detectado',
    reviewedBy: null,
    resolution: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  });
  if (!recorded.ok) {
    return recorded;
  }

  return failure('CONFLICTO_EDICION_OFFLINE', 'El acta fue modificada posteriormente');
}
