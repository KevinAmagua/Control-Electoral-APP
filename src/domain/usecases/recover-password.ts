import { failure, type Result } from '../../core/result/result';
import type { PasswordRecoveryInput } from '../auth/credentials';
import type { AuthRepository } from '../repositories/auth-repository';
import type { UserRepository } from '../repositories/user-repository';
import { emailSchema } from '../validation/contact';
import { formatValidationError } from '../validation/messages';

export function createRecoverPasswordUseCase(auth: AuthRepository, users: UserRepository) {
  return async (input: PasswordRecoveryInput): Promise<Result<void>> => {
    const email = emailSchema.safeParse(input.email);
    if (!email.success) {
      return failure('CORREO_INVALIDO', formatValidationError(email.error));
    }

    const profileResult = await users.getByEmail(email.data);
    if (!profileResult.ok) {
      return profileResult;
    }

    const profile = profileResult.value;
    if (!profile || !profile.active) {
      return failure('CUENTA_NO_EXISTE', 'No existe una cuenta activa con ese correo');
    }
    if (!profile.emailVerified) {
      return failure('CORREO_NO_VERIFICADO', 'Debe verificar su correo antes de recuperar la clave');
    }

    return auth.requestPasswordRecovery({ email: profile.email });
  };
}
