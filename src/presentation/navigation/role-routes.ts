import type { Session } from '@/domain/auth/session';
import type { Role } from '@/domain/user/role';

export type AppRoute =
  | '/login'
  | '/cambiar-clave'
  | '/recuperar-clave'
  | '/confirmar-correo'
  | '/callback'
  | '/restablecer-clave'
  | '/dashboard'
  | '/revision-actas'
  | '/gestion-recintos'
  | '/recinto'
  | '/asignar-veedores'
  | '/nuevo-veedor'
  | '/nueva-mesa'
  | '/conflictos'
  | '/mesas'
  | '/registrar-acta'
  | '/estados-acta'
  | '/perfil-provincial'
  | '/perfil-recinto'
  | '/perfil-veedor';

const roleRoute: Record<Role, AppRoute> = {
  coordinador_provincial: '/dashboard',
  coordinador_recinto: '/recinto',
  veedor: '/mesas',
};

export function getHomeRoute(session: Session): AppRoute {
  if (session.status !== 'authenticated' || !session.role) {
    return '/login';
  }

  if (session.mustChangePassword) {
    return '/restablecer-clave';
  }

  return roleRoute[session.role];
}
