import { failure, type Result } from '../../core/result/result';
import type { PasswordRecoveryInput } from '../auth/credentials';
import type { AuthRepository } from '../repositories/auth-repository';
import { emailSchema } from '../validation/contact';
import { formatValidationError } from '../validation/messages';

export function createRecoverPasswordUseCase(auth: AuthRepository) {
  return async (input: PasswordRecoveryInput): Promise<Result<void>> => {
    const email = emailSchema.safeParse(input.email);
    if (!email.success) {
      return failure('CORREO_INVALIDO', formatValidationError(email.error));
    }

    return auth.requestPasswordRecovery({ email: email.data });
  };
}
