import { failure, type Result } from '../../core/result/result';
import type { Session } from '../auth/session';
import type { LoginCredentials } from '../auth/credentials';
import type { AuthRepository } from '../repositories/auth-repository';
import { emailSchema } from '../validation/contact';
import { formatValidationError } from '../validation/messages';

export function createLoginUseCase(auth: AuthRepository) {
  return async (credentials: LoginCredentials): Promise<Result<Session>> => {
    const email = emailSchema.safeParse(credentials.email);
    if (!email.success) {
      return failure('CORREO_INVALIDO', formatValidationError(email.error));
    }
    if (credentials.password.length === 0) {
      return failure('CLAVE_REQUERIDA', 'Ingrese su contraseña');
    }

    return auth.login({ email: email.data, password: credentials.password });
  };
}
