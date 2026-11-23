import type { Jurisdiction } from '../election/jurisdiction';
import type { Role } from './role';

export type UserProfile = {
  id: string;
  role: Role;
  cedula: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  emailVerified: boolean;
  mustChangePassword: boolean;
  recintoId: string | null;
  province: string | null;
  canton: string | null;
  active: boolean;
};

export type CreateUserInput = {
  role: Role;
  cedula: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  recintoId: string | null;
  jurisdiction?: Jurisdiction;
};

export function fullName(profile: UserProfile): string {
  return `${profile.firstName} ${profile.lastName}`.trim();
}

export function isCoordinator(profile: UserProfile): boolean {
  return profile.role === 'coordinador_provincial' || profile.role === 'coordinador_recinto';
}
