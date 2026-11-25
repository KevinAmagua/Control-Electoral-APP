import { ok, failure, type Result } from '../../core/result/result';
import type { Assignment } from '../election/assignment';
import type { Recinto } from '../election/recinto';
import type { AssignmentRepository } from '../repositories/assignment-repository';
import type { TerritoryRepository } from '../repositories/territory-repository';
import type { UserRepository } from '../repositories/user-repository';
import { canAccessRecinto } from '../user/permissions';
import { createRecintoSchema, recintoCodePrefixForLocation } from '../validation/territory';
import { formatValidationError } from '../validation/messages';

type TerritoryUseCaseDependencies = {
  territory: TerritoryRepository;
  users: UserRepository;
  assignments: AssignmentRepository;
};

export function createRecintoUseCase(dependencies: Pick<TerritoryUseCaseDependencies, 'territory' | 'users'>) {
  return async (input: {
    actorId: string;
    data: unknown;
  }): Promise<Result<Recinto>> => {
    const actorResult = await dependencies.users.getById(input.actorId);
    if (!actorResult.ok) {
      return actorResult;
    }
    const actor = actorResult.value;
    if (!actor || actor.role !== 'coordinador_provincial' || !actor.active) {
      return failure('NO_AUTORIZADO', 'Solo el coordinador provincial puede registrar recintos');
    }

    const parsed = createRecintoSchema.safeParse(input.data);
    if (!parsed.success) {
      return failure('DATOS_INVALIDOS', formatValidationError(parsed.error));
    }
    if (parsed.data.province !== actor.province || parsed.data.canton !== actor.canton) {
      return failure('FUERA_DE_JURISDICCION', 'El recinto debe pertenecer a su provincia y cantón');
    }
    const expectedPrefix = recintoCodePrefixForLocation(
      parsed.data.province,
      parsed.data.canton,
    );
    if (!parsed.data.code.startsWith(expectedPrefix)) {
      return failure('CODIGO_FUERA_DE_JURISDICCION', `El código debe iniciar con ${expectedPrefix}`);
    }

    return dependencies.territory.createRecinto(parsed.data);
  };
}

export function createListRecintosUseCase(dependencies: TerritoryUseCaseDependencies) {
  return async (actorId: string): Promise<Result<Recinto[]>> => {
    const actorResult = await dependencies.users.getById(actorId);
    if (!actorResult.ok) {
      return actorResult;
    }
    const actor = actorResult.value;
    if (!actor || !actor.active) {
      return failure('NO_AUTORIZADO', 'El usuario no está activo');
    }

    const [recintosResult, mesasResult] = await Promise.all([
      dependencies.territory.listRecintos(),
      dependencies.territory.listMesas(),
    ]);
    if (!recintosResult.ok) {
      return recintosResult;
    }
    if (!mesasResult.ok) {
      return mesasResult;
    }

    let activeAssignments: Assignment[] = [];
    if (actor.role === 'veedor') {
      const assignmentsResult = await dependencies.assignments.listByVeedor(actor.id);
      if (!assignmentsResult.ok) {
        return assignmentsResult;
      }
      activeAssignments = assignmentsResult.value.filter((assignment) => assignment.active);
    }

    return ok(
      recintosResult.value.filter((recinto) =>
        canAccessRecinto(actor, recinto, mesasResult.value, activeAssignments),
      ),
    );
  };
}

export function createAssignRecintoCoordinatorUseCase(
  dependencies: Pick<TerritoryUseCaseDependencies, 'territory' | 'users'>,
) {
  return async (input: {
    actorId: string;
    recintoId: string;
    coordinadorId: string;
  }): Promise<Result<Recinto>> => {
    const [actorResult, recintoResult, coordinadorResult] = await Promise.all([
      dependencies.users.getById(input.actorId),
      dependencies.territory.getRecinto(input.recintoId),
      dependencies.users.getById(input.coordinadorId),
    ]);
    if (!actorResult.ok) {
      return actorResult;
    }
    if (!recintoResult.ok) {
      return recintoResult;
    }
    if (!coordinadorResult.ok) {
      return coordinadorResult;
    }

    const actor = actorResult.value;
    const recinto = recintoResult.value;
    const coordinador = coordinadorResult.value;

    if (!actor || actor.role !== 'coordinador_provincial' || !actor.active) {
      return failure('NO_AUTORIZADO', 'Solo el coordinador provincial puede asignar coordinadores');
    }
    if (!recinto || recinto.province !== actor.province || recinto.canton !== actor.canton) {
      return failure('FUERA_DE_JURISDICCION', 'El recinto no pertenece a su jurisdicción');
    }
    if (!coordinador || coordinador.role !== 'coordinador_recinto' || !coordinador.active) {
      return failure('COORDINADOR_INVALIDO', 'El usuario debe ser un coordinador de recinto activo');
    }

    const byRecinto = await dependencies.users.listByRecinto(recinto.id);
    if (!byRecinto.ok) {
      return byRecinto;
    }
    const assigned = byRecinto.value.find(
      (profile) => profile.role === 'coordinador_recinto' && profile.active,
    );
    if (assigned && assigned.id !== coordinador.id) {
      return failure(
        'COORDINADOR_YA_ASIGNADO',
        'Ya hay un coordinador asignado a este recinto. No se puede reasignar otro.',
      );
    }
    if (assigned) {
      return ok(recinto);
    }

    return dependencies.territory.setRecintoCoordinator(recinto.id, coordinador.id);
  };
}
