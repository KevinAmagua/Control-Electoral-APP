import { failure, ok, type Result } from '@/core/result/result';
import type {
  LoginCredentials,
  PasswordChangeInput,
  PasswordRecoveryInput,
} from '@/domain/auth/credentials';
import type { Session as DomainSession } from '@/domain/auth/session';
import type { AuthRepository } from '@/domain/repositories/auth-repository';

import { createClient } from '@supabase/supabase-js';

import {
  AUTH_REDIRECT_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  supabase,
} from './client';
import { toFailure } from './errors';
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

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfile(data as ProfileRow) : null;
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

function paramsFromCallbackUrl(url: string): URLSearchParams {
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
    if (!profile || !profile.active) {
      return ok(guestSession);
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
        if (!profile || !profile.active) {
          await signOutLocal();
          return failure('CUENTA_INACTIVA', 'La cuenta no existe o está inactiva');
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
      try {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (error) {
          return toFailure(error, 'ERROR_REENVIO_CONFIRMACION');
        }
        return ok(undefined);
      } catch (error) {
        return toFailure(error, 'ERROR_REENVIO_CONFIRMACION');
      }
    },

    async consumeAuthCallback(url: string): Promise<Result<DomainSession>> {
      try {
        const params = paramsFromCallbackUrl(url);
        const errorCode = params.get('error') ?? params.get('error_code');
        const errorDescription = params.get('error_description');
        if (errorCode || errorDescription) {
          return failure(
            'ERROR_CALLBACK_AUTH',
            errorDescription ?? 'No fue posible completar la verificación del correo',
          );
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
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
          redirectTo: AUTH_REDIRECT_URL,
        });
        if (error) {
          return toFailure(error, 'ERROR_RECUPERACION');
        }
        return ok(undefined);
      } catch (error) {
        return toFailure(error, 'ERROR_RECUPERACION');
      }
    },

    async signOut(): Promise<Result<void>> {
      await signOutLocal();
      return ok(undefined);
    },
  };
}
