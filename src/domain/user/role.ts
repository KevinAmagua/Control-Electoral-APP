export const ROLES = [
  'coordinador_provincial',
  'coordinador_recinto',
  'veedor',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  coordinador_provincial: 'Coordinador provincial',
  coordinador_recinto: 'Coordinador de recinto',
  veedor: 'Veedor',
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
