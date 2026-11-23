import { failure, type Result } from '../../core/result/result';
import type { PasswordChangeInput } from '../auth/credentials';
import type { Session } from '../auth/session';
import type { AuthRepository } from '../repositories/auth-repository';
import { passwordSchema } from '../validation/contact';
import { formatValidationError } from '../validation/messages';

export function createChangePasswordUseCase(auth: AuthRepository) {
  return async (input: PasswordChangeInput): Promise<Result<Session>> => {
    if (input.newPassword === input.currentPassword) {
      return failure('CLAVE_REPETIDA', 'La nueva contraseña debe ser diferente');
    }

    const password = passwordSchema.safeParse(input.newPassword);
    if (!password.success) {
      return failure('CLAVE_DEBIL', formatValidationError(password.error));
    }

    return auth.changePassword({
      currentPassword: input.currentPassword,
      newPassword: password.data,
    });
  };
}
