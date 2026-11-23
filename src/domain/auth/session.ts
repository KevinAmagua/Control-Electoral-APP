import type { Role } from '../user/role';

export type SessionStatus = 'guest' | 'authenticated';

export type Session = {
  status: SessionStatus;
  role: Role | null;
  mustChangePassword: boolean;
  emailVerified: boolean;
};
