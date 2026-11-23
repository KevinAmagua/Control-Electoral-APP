import { failure, type Result } from '../../core/result/result';
import type { AuthRepository } from '../repositories/auth-repository';
import type { Session } from '../auth/session';
import { passwordSchema } from '../validation/contact';
import { formatValidationError } from '../validation/messages';

export function createResetPasswordUseCase(auth: AuthRepository) {
  return async (newPassword: string): Promise<Result<Session>> => {
    const password = passwordSchema.safeParse(newPassword);
    if (!password.success) {
      return failure('CLAVE_DEBIL', formatValidationError(password.error));
    }

    return auth.resetPassword(password.data);
  };
}
