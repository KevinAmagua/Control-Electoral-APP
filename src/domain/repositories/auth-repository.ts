import type { Result } from '../../core/result/result';
import type {
  LoginCredentials,
  PasswordChangeInput,
  PasswordRecoveryInput,
} from '../auth/credentials';
import type { Session } from '../auth/session';

export interface AuthRepository {
  login(credentials: LoginCredentials): Promise<Result<Session>>;
  getCurrentSession(): Promise<Result<Session | null>>;
  changePassword(input: PasswordChangeInput): Promise<Result<Session>>;
  resetPassword(newPassword: string): Promise<Result<Session>>;
  resendConfirmation(email: string): Promise<Result<void>>;
  consumeAuthCallback(url: string): Promise<Result<Session>>;
  requestPasswordRecovery(input: PasswordRecoveryInput): Promise<Result<void>>;
  signOut(): Promise<Result<void>>;
}
