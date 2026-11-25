import { failure, ok, type Result } from '@/core/result/result';
import type { UserProfile } from '@/domain/user/profile';
import type { UserRepository, CreateUserRecord } from '@/domain/repositories/user-repository';

import * as Linking from 'expo-linking';

import { queryWithLocalCache } from '../../local/sqliteClient';
import { supabase } from './client';
import { toFailure } from './errors';
import { mapProfile, type ProfileRow } from './mappers';

export type CreatedUserResult = {
  profile: UserProfile;
  temporaryPassword: string | null;
};

export type SupabaseUserRepository = UserRepository & {
  createWithTemporaryPassword(input: CreateUserRecord): Promise<Result<CreatedUserResult>>;
};

type CreateUserResponse = {
  profile?: ProfileRow;
  temporaryPassword?: string;
};

type FunctionErrorBody = {
  error?: string;
  message?: string;
};

type FunctionErrorContext = {
  json?: () => Promise<unknown>;
  clone?: () => { json: () => Promise<unknown> };
};

const FUNCTION_ERROR_MESSAGES: Record<string, string> = {
  METODO_NO_PERMITIDO: 'Método no permitido',
  CONFIGURACION_INVALIDA: 'Configuración del servidor inválida',
  SOLICITUD_INVALIDA: 'Cuerpo de solicitud inválido',
  ROL_INVALIDO: 'Rol inválido',
  CEDULA_INVALIDA: 'Cédula ecuatoriana inválida',
  NOMBRE_INVALIDO: 'El nombre debe tener al menos 2 caracteres',
  APELLIDO_INVALIDO: 'El apellido debe tener al menos 2 caracteres',
  TELEFONO_INVALIDO: 'Teléfono ecuatoriano inválido',
  CORREO_INVALIDO: 'Correo electrónico inválido',
  CREADOR_INVALIDO: 'Usuario creador inválido',
  RECINTO_REQUERIDO: 'Indique el recinto correspondiente',
  JURISDICCION_REQUERIDA: 'Indique la provincia y el cantón del coordinador',
  JERARQUIA_INVALIDA: 'Su rol no puede crear este tipo de cuenta',
  FUERA_DE_JURISDICCION: 'El usuario está fuera de su jurisdicción',
  RECINTO_NO_ENCONTRADO: 'No se encontró el recinto indicado',
  CORREO_NO_VERIFICADO: 'Debe verificar su correo electrónico antes de continuar',
  NO_AUTORIZADO: 'No tiene permiso para realizar esta operación',
  PERFIL_NO_ENCONTRADO: 'No se encontró el perfil del usuario',
  CORREO_YA_REGISTRADO: 'Ya existe una cuenta con ese correo',
  CEDULA_YA_REGISTRADA: 'Ya existe una cuenta con esa cédula',
  REDIRECT_INVALIDO: 'La URL de retorno no es válida',
  ERROR_CONSULTAR_USUARIO: 'No fue posible validar el usuario',
  ERROR_LIMPIAR_USUARIO: 'No fue posible preparar la cuenta para la invitación',
  ERROR_INVITAR_USUARIO: 'No fue posible enviar la invitación',
  ERROR_SMTP: 'El servidor de correo no está configurado correctamente. Revise SMTP en Supabase.',
  LIMITE_CORREOS: 'Se alcanzó el límite de correos por hora. Intente más tarde',
  ERROR_ASIGNAR_CLAVE: 'No fue posible asignar la contraseña temporal',
  ERROR_CREAR_PERFIL: 'No fue posible crear el perfil del usuario',
  ERROR_CREAR_USUARIO: 'No fue posible crear el usuario',
};

function getConfirmRedirectUrl(): string | undefined {
  try {
    return Linking.createURL('/confirmar-correo');
  } catch {
    return undefined;
  }
}

function isFunctionErrorBody(value: unknown): value is FunctionErrorBody {
  return typeof value === 'object' && value !== null;
}

function functionFailure(value: unknown, fallbackCode: string): Result<never> {
  const body = isFunctionErrorBody(value) ? value : null;
  const code = body?.error && body.error.length > 0 ? body.error : fallbackCode;
  const message = body?.message && body.message.length > 0
    ? body.message
    : FUNCTION_ERROR_MESSAGES[code] ?? FUNCTION_ERROR_MESSAGES[fallbackCode];
  return failure(code, message);
}

async function readFunctionError(error: unknown): Promise<unknown> {
  const context = (error as { context?: FunctionErrorContext }).context;
  if (!context) {
    return null;
  }
  if (typeof context.json === 'function') {
    const direct = await context.json().catch(() => null);
    if (direct) {
      return direct;
    }
  }
  if (typeof context.clone === 'function') {
    return await context.clone().json().catch(() => null);
  }
  return null;
}

async function fetchOne(column: 'id' | 'email' | 'cedula', value: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq(column, value)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfile(data as ProfileRow) : null;
}

export function createSupabaseUserRepository(): SupabaseUserRepository {
  const createWithTemporaryPassword = async (
    input: CreateUserRecord,
  ): Promise<Result<CreatedUserResult>> => {
    try {
      const { data, error } = await supabase.functions.invoke<CreateUserResponse>('create-user', {
        body: { ...input, redirectTo: getConfirmRedirectUrl() },
      });
      if (error) {
        return functionFailure(await readFunctionError(error), 'ERROR_CREAR_USUARIO');
      }
      if (!data?.profile) {
        return functionFailure(data, 'ERROR_CREAR_USUARIO');
      }

      return ok({
        profile: mapProfile(data.profile),
        temporaryPassword: data.temporaryPassword ?? null,
      });
    } catch (error) {
      return toFailure(error, 'ERROR_CREAR_USUARIO');
    }
  };

  return {
    async getById(id): Promise<Result<UserProfile | null>> {
      return queryWithLocalCache(`profile:${id}`, async () => {
        try {
          return ok(await fetchOne('id', id));
        } catch (error) {
          return toFailure(error, 'ERROR_CONSULTAR_USUARIO');
        }
      });
    },

    async getByEmail(email): Promise<Result<UserProfile | null>> {
      const normalized = email.trim().toLowerCase();
      return queryWithLocalCache(`profile:email:${normalized}`, async () => {
        try {
          return ok(await fetchOne('email', normalized));
        } catch (error) {
          return toFailure(error, 'ERROR_CONSULTAR_USUARIO');
        }
      });
    },

    async getByCedula(cedula): Promise<Result<UserProfile | null>> {
      return queryWithLocalCache(`profile:cedula:${cedula}`, async () => {
        try {
          return ok(await fetchOne('cedula', cedula));
        } catch (error) {
          return toFailure(error, 'ERROR_CONSULTAR_USUARIO');
        }
      });
    },

    async listByRecinto(recintoId): Promise<Result<UserProfile[]>> {
      return queryWithLocalCache(`profiles:recinto:${recintoId}`, async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('recinto_id', recintoId)
            .order('last_name', { ascending: true });
          if (error) {
            throw error;
          }
          return ok((data ?? []).map((row) => mapProfile(row as ProfileRow)));
        } catch (error) {
          return toFailure(error, 'ERROR_LISTAR_USUARIOS');
        }
      });
    },

    createWithTemporaryPassword,

    async create(input): Promise<Result<UserProfile>> {
      const result = await createWithTemporaryPassword(input);
      return result.ok ? ok(result.value.profile) : result;
    },

    async deactivate(id): Promise<Result<void>> {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) {
          throw error;
        }
        return ok(undefined);
      } catch (error) {
        return toFailure(error, 'ERROR_DESACTIVAR_USUARIO');
      }
    },
  };
}
