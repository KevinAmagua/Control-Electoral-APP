import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ok, type Result } from '@/core/result/result';
import { dataContainer } from '@/data/container';
import { setSentryUser } from '@/data/monitoring/sentry';
import { getCurrentAuthUser, supabase } from '@/data/remote/supabase/client';
import type { Session as DomainSession } from '@/domain/auth/session';

const guestSession: DomainSession = {
  status: 'guest',
  role: null,
  mustChangePassword: false,
  emailVerified: false,
};

type SessionContextValue = DomainSession & {
  userId: string | null;
  email: string | null;
  isLoading: boolean;
  refresh: () => Promise<Result<DomainSession>>;
  signIn: (email: string, password: string) => Promise<Result<DomainSession>>;
  signOut: () => Promise<Result<void>>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<Result<DomainSession>>;
  resetPassword: (newPassword: string) => Promise<Result<DomainSession>>;
  requestPasswordRecovery: (email: string) => Promise<Result<void>>;
  resendConfirmation: (email: string) => Promise<Result<void>>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DomainSession>(guestSession);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSessionState = useCallback(() => {
    setSession(guestSession);
    setUserId(null);
    setEmail(null);
    setSentryUser(null);
  }, []);

  const applySession = useCallback(
    async (result: Result<DomainSession | null>): Promise<Result<DomainSession>> => {
      if (!result.ok) {
        if (result.error.code === 'CORREO_NO_VERIFICADO') {
          clearSessionState();
        }
        return result;
      }

      const next = result.value ?? guestSession;
      const authUser = next.status === 'authenticated' ? await getCurrentAuthUser() : null;
      setSession(next);
      setUserId(authUser?.id ?? null);
      setEmail(authUser?.email ?? null);
      return ok(next);
    },
    [clearSessionState],
  );

  useEffect(() => {
    setSentryUser(session.status === 'authenticated' ? userId : null);
  }, [session.status, userId]);

  const refresh = useCallback(async (): Promise<Result<DomainSession>> => {
    setIsLoading(true);
    try {
      const result = await dataContainer.repositories.auth.getCurrentSession();
      return await applySession(result);
    } finally {
      setIsLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    void Promise.resolve().then(() => {
      void refresh();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    if (session.status !== 'authenticated') {
      return;
    }

    void dataContainer.outbox.start();
    return () => {
      dataContainer.outbox.stop();
    };
  }, [session.status]);

  const signIn = useCallback(async (emailValue: string, password: string) => {
    const result = await dataContainer.useCases.login({ email: emailValue, password });
    return applySession(result);
  }, [applySession]);

  const signOut = useCallback(async () => {
    clearSessionState();
    await dataContainer.repositories.auth.signOut();
    return ok(undefined);
  }, [clearSessionState]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await dataContainer.useCases.changePassword({ currentPassword, newPassword });
    return applySession(result);
  }, [applySession]);

  const resetPassword = useCallback(async (newPassword: string) => {
    const result = await dataContainer.useCases.resetPassword(newPassword);
    return applySession(result);
  }, [applySession]);

  const requestPasswordRecovery = useCallback(async (emailValue: string) => {
    const result = await dataContainer.useCases.recoverPassword({ email: emailValue });
    return result;
  }, []);

  const resendConfirmation = useCallback(async (emailValue: string) => {
    const result = await dataContainer.repositories.auth.resendConfirmation(emailValue);
    return result;
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    ...session,
    userId,
    email,
    isLoading,
    refresh,
    signIn,
    signOut,
    changePassword,
    resetPassword,
    requestPasswordRecovery,
    resendConfirmation,
  }), [
    session,
    userId,
    email,
    isLoading,
    refresh,
    signIn,
    signOut,
    changePassword,
    resetPassword,
    requestPasswordRecovery,
    resendConfirmation,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return context;
}
