import { failure, type Result } from '@/core/result/result';

const MESSAGE_OVERRIDES: readonly [string, string][] = [
  ['CONFLICTO_EDICION_OFFLINE', 'El acta fue modificada posteriormente'],
  ['CUADRE_MATEMATICO_INVALIDO', 'El cuadre matemático del acta no es válido'],
  ['SUMA_DE_LISTAS_NO_COINCIDE_CON_VOTOS_VALIDOS', 'La suma de listas no coincide con los votos válidos'],
  ['SIN_PERMISO_PARA_LA_MESA', 'No tiene permiso para registrar en esta mesa'],
  ['EL_USUARIO_ASIGNADO_DEBE_SER_VEEDOR', 'El usuario asignado debe ser veedor'],
  ['EL_REEMPLAZO_DEBE_SER_PARA_LA_MISMA_MESA', 'El reemplazo debe ser para la misma mesa'],
  ['Invalid login credentials', 'Correo o contraseña incorrectos'],
  ['Email not confirmed', 'Debe verificar su correo electrónico antes de ingresar'],
  ['same_password', 'La contraseña ya está establecida. Inicie sesión con la contraseña que acaba de guardar.'],
  ['New password should be different from the old password.', 'La contraseña ya está establecida. Inicie sesión con la contraseña que acaba de guardar.'],
  ['Token has expired or is invalid', 'El código venció o no es válido. Solicite uno nuevo'],
  ['Invalid token', 'El código venció o no es válido. Solicite uno nuevo'],
  ['over_email_send_rate_limit', 'Se alcanzó el límite de correos por hora. Intente más tarde'],
  ['email rate limit exceeded', 'Se alcanzó el límite de correos por hora. Intente más tarde'],
  ['User already registered', 'Ya existe una cuenta con ese correo'],
  ['duplicate key value', 'Ya existe un registro con esos datos'],
  ['row-level security policy', 'No tiene permiso para realizar esta operación'],
];

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return 'Error inesperado';
}

export function errorCode(error: unknown, fallback: string): string {
  const message = errorMessage(error);
  if (message.includes('CONFLICTO_EDICION_OFFLINE')) {
    return 'CONFLICTO_EDICION_OFFLINE';
  }
  if (message.includes('CUADRE_MATEMATICO_INVALIDO')) {
    return 'CUADRE_MATEMATICO_INVALIDO';
  }
  if (message.includes('SUMA_DE_LISTAS_NO_COINCIDE_CON_VOTOS_VALIDOS')) {
    return 'SUMA_DE_LISTAS_NO_COINCIDE_CON_VOTOS_VALIDOS';
  }
  if (message.includes('SIN_PERMISO_PARA_LA_MESA') || message.includes('row-level security')) {
    return 'NO_AUTORIZADO';
  }
  if (message.includes('Email not confirmed')) {
    return 'CORREO_NO_VERIFICADO';
  }
  if (
    message.includes('same_password') ||
    message.includes('New password should be different from the old password.')
  ) {
    return 'CLAVE_YA_ESTABLECIDA';
  }
  if (message.includes('Invalid login credentials')) {
    return 'CREDENCIALES_INVALIDAS';
  }
  if (
    message.includes('over_email_send_rate_limit') ||
    message.includes('email rate limit exceeded')
  ) {
    return 'LIMITE_CORREOS';
  }
  if (message.includes('User already registered') || message.includes('duplicate key value')) {
    return 'REGISTRO_DUPLICADO';
  }
  return fallback;
}

export function toFailure<T>(error: unknown, fallback: string): Result<T> {
  const rawMessage = errorMessage(error);
  const override = MESSAGE_OVERRIDES.find(([needle]) => rawMessage.includes(needle));
  return failure(errorCode(error, fallback), override?.[1] ?? rawMessage);
}
