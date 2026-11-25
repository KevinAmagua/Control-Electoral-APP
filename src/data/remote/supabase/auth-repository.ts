import { failure, ok, type Result } from '@/core/result/result';
import type {
  LoginCredentials,
  PasswordChangeInput,
  PasswordRecoveryInput,
} from '@/domain/auth/credentials';
import type { Session as DomainSession } from '@/domain/auth/session';
import type { AuthRepository } from '@/domain/repositories/auth-repository';
import type { UserProfile } from '@/domain/user/profile';

import * as Linking from 'expo-linking';
import { createClient, type EmailOtpType } from '@supabase/supabase-js';

import { queryWithLocalCache } from '../../local/sqliteClient';
import {
  AUTH_REDIRECT_URL,
  CONFIRM_EMAIL_REDIRECT_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  supabase,
} from './client';
import { errorMessage, toFailure } from './errors';
import { mapProfile, type ProfileRow } from './mappers';

type AuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

type Profile = NonNullable<Awaited<ReturnType<typeof fetchProfile>>>;

const guestSession: DomainSession = {
  status: 'guest',
  role: null,
  mustChangePassword: false,
  emailVerified: false,
};

const VERIFICATION_ERROR = failure<DomainSession>(
  'CORREO_NO_VERIFICADO',
  'Debe verificar su correo electrónico antes de continuar',
);

const AUTH_EMAIL_ERROR_MESSAGES = {
  ERROR_SMTP: 'El servidor de correo no está configurado correctamente. Revise SMTP en Supabase.',
  ERROR_ENVIAR_CORREO: 'No fue posible enviar el correo',
} as const;

const EMAIL_OTP_VERIFY_TYPES: EmailOtpType[] = ['invite', 'email', 'magiclink', 'signup'];

function getAuthRedirectUrl(type: 'signup' | 'recovery'): string {
  try {
    return Linking.createURL(type === 'recovery' ? '/callback' : '/confirmar-correo');
  } catch {
    return type === 'recovery' ? AUTH_REDIRECT_URL : CONFIRM_EMAIL_REDIRECT_URL;
  }
}

function isSmtpFailure(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes('535') ||
    message.includes('username and password not accepted') ||
    message.includes('unexpected_failure') ||
    message.includes('unexpected failure')
  );
}

async function requestAuthEmail(type: 'signup' | 'recovery', email: string): Promise<Result<void>> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const redirectTo = getAuthRedirectUrl(type);
    const { error } = type === 'recovery'
      ? await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })
      : await supabase.auth.resend({
          type: 'signup',
          email: normalizedEmail,
          options: {
            emailRedirectTo: redirectTo,
          },
        });

    if (error) {
      if (isSmtpFailure(error)) {
        return failure('ERROR_SMTP', AUTH_EMAIL_ERROR_MESSAGES.ERROR_SMTP);
      }
      return toFailure(error, 'ERROR_ENVIAR_CORREO');
    }

    return ok(undefined);
  } catch (error) {
    if (isSmtpFailure(error)) {
      return failure('ERROR_SMTP', AUTH_EMAIL_ERROR_MESSAGES.ERROR_SMTP);
    }
    return toFailure(error, 'ERROR_ENVIAR_CORREO');
  }
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const result = await queryWithLocalCache<UserProfile | null>(`profile:${userId}`, async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return ok(data ? mapProfile(data as ProfileRow) : null);
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function toSession(user: AuthUser, profile: Profile): DomainSession {
  return {
    status: 'authenticated',
    role: profile.role,
    mustChangePassword: profile.mustChangePassword,
    emailVerified: profile.emailVerified,
  } satisfies DomainSession;
}

function verifiedSession(user: AuthUser, profile: Profile): Result<DomainSession> {
  if (!profile.emailVerified || !user.email_confirmed_at) {
    return VERIFICATION_ERROR;
  }
  return ok(toSession(user, profile));
}

function createCredentialValidationClient() {
  const storage = new Map<string, string>();

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: {
        getItem: async (key: string) => storage.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: async (key: string) => {
          storage.delete(key);
        },
      },
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function paramsFromCallbackUrl(url: string, depth = 0): URLSearchParams {
  const params = new URLSearchParams();
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const query = queryIndex >= 0
    ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
    : '';
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1).replace(/^\//, '') : '';

  for (const [key, value] of new URLSearchParams(query)) {
    params.set(key, value);
  }
  for (const [key, value] of new URLSearchParams(hash)) {
    params.set(key, value);
  }

  const nested = params.get('q') ?? params.get('url') ?? params.get('target');
  const hasAuthParams = ['token', 'token_hash', 'access_token', 'code'].some((key) =>
    params.has(key),
  );
  if (nested && !hasAuthParams && /^https?:\/\//i.test(nested) && depth < 3) {
    return paramsFromCallbackUrl(nested, depth + 1);
  }
  return params;
}

async function readCurrentSession(): Promise<Result<DomainSession>> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return toFailure(error, 'ERROR_SESION');
    }

    const user = data.session?.user as AuthUser | undefined;
    if (!user) {
      return ok(guestSession);
    }

    const profile = await fetchProfile(user.id);
    if (!profile) {
      await signOutLocal();
      return failure('CUENTA_INACTIVA', 'No se encontró el perfil de la cuenta');
    }
    if (!profile.active) {
      await signOutLocal();
      return failure('CUENTA_INACTIVA', 'La cuenta está inactiva. Contacte al administrador.');
    }

    const session = verifiedSession(user, profile);
    if (!session.ok) {
      await signOutLocal();
      return session;
    }
    return session;
  } catch (error) {
    return toFailure(error, 'ERROR_SESION');
  }
}

async function signOutLocal(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    return;
  }
}

async function requireActiveSession(): Promise<Result<DomainSession>> {
  const current = await readCurrentSession();
  if (!current.ok) {
    return current;
  }
  if (current.value.status !== 'authenticated') {
    return failure('SESION_INVALIDA', 'Inicie sesión para continuar');
  }
  return current;
}

export function createSupabaseAuthRepository(): AuthRepository {
  return {
    async login(credentials: LoginCredentials): Promise<Result<DomainSession>> {
      try {
        const { data, error } = await supabase.auth.signInWithPassword(credentials);
        if (error) {
          return toFailure(error, 'ERROR_INICIO_SESION');
        }

        const user = data.user as AuthUser | null;
        if (!user) {
          return failure('ERROR_INICIO_SESION', 'No fue posible iniciar sesión');
        }
        if (!user.email_confirmed_at) {
          await signOutLocal();
          return VERIFICATION_ERROR;
        }

        const profile = await fetchProfile(user.id);
        if (!profile) {
          await signOutLocal();
          return failure('CUENTA_INACTIVA', 'No se encontró el perfil de la cuenta');
        }
        if (!profile.active) {
          await signOutLocal();
          return failure('CUENTA_INACTIVA', 'La cuenta está inactiva. Contacte al administrador.');
        }

        const session = verifiedSession(user, profile);
        if (!session.ok) {
          await signOutLocal();
          return session;
        }
        return session;
      } catch (error) {
        return toFailure(error, 'ERROR_INICIO_SESION');
      }
    },

    async getCurrentSession(): Promise<Result<DomainSession | null>> {
      return readCurrentSession();
    },

    async changePassword(input: PasswordChangeInput): Promise<Result<DomainSession>> {
      try {
        const active = await requireActiveSession();
        if (!active.ok) {
          return active;
        }

        const validationClient = createCredentialValidationClient();
        const email = (await supabase.auth.getUser()).data.user?.email ?? '';
        if (!email) {
          return failure('SESION_INVALIDA', 'La sesión no es válida');
        }

        const validated = await validationClient.auth.signInWithPassword({
          email,
          password: input.currentPassword,
        });
        if (validated.error || !validated.data.user) {
          return failure('CLAVE_ACTUAL_INVALIDA', 'La contraseña actual es incorrecta');
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: input.newPassword,
        });
        if (updateError) {
          return toFailure(updateError, 'ERROR_CAMBIO_CLAVE');
        }

        const { error: flagError } = await supabase.rpc('completar_cambio_clave');
        if (flagError) {
          return toFailure(flagError, 'ERROR_CAMBIO_CLAVE');
        }

        return readCurrentSession();
      } catch (error) {
        return toFailure(error, 'ERROR_CAMBIO_CLAVE');
      }
    },

    async resetPassword(newPassword: string): Promise<Result<DomainSession>> {
      try {
        const active = await requireActiveSession();
        if (!active.ok) {
          return active;
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) {
          return toFailure(updateError, 'ERROR_RESTABLECER_CLAVE');
        }

        const { error: flagError } = await supabase.rpc('completar_cambio_clave');
        if (flagError) {
          return toFailure(flagError, 'ERROR_RESTABLECER_CLAVE');
        }

        return readCurrentSession();
      } catch (error) {
        return toFailure(error, 'ERROR_RESTABLECER_CLAVE');
      }
    },

    async resendConfirmation(email: string): Promise<Result<void>> {
      return requestAuthEmail('signup', email);
    },

    async verifyEmailOtp(email, token): Promise<Result<DomainSession>> {
      let lastError: unknown = null;

      for (const type of EMAIL_OTP_VERIFY_TYPES) {
        try {
          const { error } = await supabase.auth.verifyOtp({ email, token, type });
          if (!error) {
            return readCurrentSession();
          }
          lastError = error;
        } catch (error) {
          lastError = error;
        }
      }

      return toFailure(lastError, 'ERROR_VERIFICAR_CODIGO');
    },

    async consumeAuthCallback(url: string): Promise<Result<DomainSession>> {
      try {
        const rawValue = url.trim();
        const rawTokenHash = /^[a-f0-9]{40}$/i.test(rawValue);
        const params = paramsFromCallbackUrl(rawValue);
        const errorCode = params.get('error') ?? params.get('error_code');
        const errorDescription = params.get('error_description');
        if (errorCode || errorDescription) {
          return failure(
            'ERROR_CALLBACK_AUTH',
            errorDescription ?? 'No fue posible completar la verificación del correo',
          );
        }

        const otpType = (params.get('type') ?? (rawTokenHash ? 'signup' : 'email')) as EmailOtpType;
        const email = params.get('email');
        const token = params.get('token_hash') ?? params.get('token') ?? (rawTokenHash ? rawValue : null);
        if (token) {
          const { error } = email && /^\d{6,10}$/.test(token)
            ? await supabase.auth.verifyOtp({ email, token, type: otpType })
            : await supabase.auth.verifyOtp({ token_hash: token, type: otpType });
          if (error) {
            return toFailure(error, 'ERROR_CALLBACK_AUTH');
          }
          return readCurrentSession();
        }

        const code = params.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            return toFailure(error, 'ERROR_CALLBACK_AUTH');
          }
          return readCurrentSession();
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (!accessToken || !refreshToken) {
          return failure('TOKENS_NO_DISPONIBLES', 'El enlace no contiene una sesión válida');
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          return toFailure(error, 'ERROR_CALLBACK_AUTH');
        }

        return readCurrentSession();
      } catch (error) {
        return toFailure(error, 'ERROR_CALLBACK_AUTH');
      }
    },

    async requestPasswordRecovery(input: PasswordRecoveryInput): Promise<Result<void>> {
      return requestAuthEmail('recovery', input.email);
    },

    async signOut(): Promise<Result<void>> {
      await signOutLocal();
      return ok(undefined);
    },
  };
}
