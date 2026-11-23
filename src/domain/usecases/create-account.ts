import { failure, ok, type Result } from '../../core/result/result';
import type { UserProfile, CreateUserInput } from '../user/profile';
import { canCreateRole } from '../user/permissions';
import type { UserRepository } from '../repositories/user-repository';
import { createUserSchema } from '../validation/user';
import { formatValidationError } from '../validation/messages';

export type CreateAccountInput = CreateUserInput & {
  createdBy: string;
};

export function createAccountUseCase(users: UserRepository) {
  return async (input: CreateAccountInput): Promise<Result<UserProfile>> => {
    const actorResult = await users.getById(input.createdBy);
    if (!actorResult.ok) {
      return actorResult;
    }

    const actor = actorResult.value;
    if (!actor) {
      return failure('ACTOR_NO_EXISTE', 'El usuario que crea la cuenta no existe');
    }
    if (!canCreateRole(actor, input.role)) {
      return failure('ROL_NO_PERMITIDO', 'Su rol no puede crear este tipo de cuenta');
    }

    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return failure('DATOS_INVALIDOS', formatValidationError(parsed.error));
    }

    if (parsed.data.role === 'coordinador_recinto' && !parsed.data.jurisdiction) {
      return failure('JURISDICCION_REQUERIDA', 'Indique la provincia y el cantón del coordinador');
    }
    if (parsed.data.role === 'veedor') {
      if (!parsed.data.recintoId) {
        return failure('RECINTO_REQUERIDO', 'Indique el recinto del veedor');
      }
      if (actor.role === 'coordinador_recinto' && parsed.data.recintoId !== actor.recintoId) {
        return failure('RECINTO_FUERA_DE_JURISDICCION', 'Solo puede crear veedores de su recinto');
      }
    }

    const byEmail = await users.getByEmail(parsed.data.email);
    if (!byEmail.ok) {
      return byEmail;
    }
    if (byEmail.value) {
      return failure('CORREO_YA_REGISTRADO', 'Ya existe una cuenta con ese correo');
    }

    const byCedula = await users.getByCedula(parsed.data.cedula);
    if (!byCedula.ok) {
      return byCedula;
    }
    if (byCedula.value) {
      return failure('CEDULA_YA_REGISTRADA', 'Ya existe una cuenta con esa cédula');
    }

    const created = await users.create({ ...parsed.data, createdBy: actor.id });
    if (!created.ok) {
      return created;
    }

    return ok(created.value);
  };
}
