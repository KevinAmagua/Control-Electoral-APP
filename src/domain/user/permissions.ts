import type { Assignment } from '../election/assignment';
import type { Mesa } from '../election/mesa';
import type { Recinto } from '../election/recinto';
import type { Role } from './role';
import type { UserProfile } from './profile';

export function canCreateRole(actor: UserProfile, target: Role): boolean {
  if (!actor.active) {
    return false;
  }
  if (actor.role === 'coordinador_provincial') {
    return target === 'coordinador_recinto';
  }
  if (actor.role === 'coordinador_recinto') {
    return target === 'veedor';
  }
  return false;
}

export function canEditRecinto(actor: UserProfile, recinto: Recinto): boolean {
  if (!actor.active) {
    return false;
  }
  if (actor.role === 'coordinador_provincial') {
    return actor.province === recinto.province && actor.canton === recinto.canton;
  }
  return actor.role === 'coordinador_recinto' && actor.recintoId === recinto.id;
}

export function canAccessRecinto(
  actor: UserProfile,
  recinto: Recinto,
  mesas: readonly Mesa[] = [],
  assignments: readonly Assignment[] = [],
): boolean {
  if (canEditRecinto(actor, recinto)) {
    return true;
  }
  if (actor.role !== 'veedor' || !actor.active) {
    return false;
  }

  return mesas.some(
    (mesa) =>
      mesa.recintoId === recinto.id &&
      assignments.some(
        (assignment) =>
          assignment.mesaId === mesa.id &&
          assignment.veedorId === actor.id &&
          assignment.active,
      ),
  );
}

export function canEditMesa(actor: UserProfile, mesa: Mesa, recinto: Recinto): boolean {
  return mesa.recintoId === recinto.id && canEditRecinto(actor, recinto);
}

export function canAccessMesa(
  actor: UserProfile,
  mesa: Mesa,
  recinto: Recinto,
  assignments: readonly Assignment[],
): boolean {
  if (actor.role === 'veedor') {
    return actor.active && assignments.some(
      (assignment) =>
        assignment.mesaId === mesa.id && assignment.veedorId === actor.id && assignment.active,
    );
  }
  return canEditMesa(actor, mesa, recinto);
}
