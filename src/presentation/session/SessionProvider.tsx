import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { ok, type Result } from '@/core/result/result';
import { dataContainer } from '@/data/container';
import type { OutboxSnapshot } from '@/data/local/sqliteClient';
import { flushSentryReports, setSentryUser } from '@/data/monitoring/sentry';
import { getCurrentAuthUser, supabase } from '@/data/remote/supabase/client';
import type { Session as DomainSession } from '@/domain/auth/session';
import { useAppStore } from '@/presentation/state/appStore';

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
  isOnline: boolean;
  outbox: OutboxSnapshot;
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
  const status = useAppStore((state) => state.status);
  const role = useAppStore((state) => state.role);
  const mustChangePassword = useAppStore((state) => state.mustChangePassword);
  const emailVerified = useAppStore((state) => state.emailVerified);
  const userId = useAppStore((state) => state.userId);
  const email = useAppStore((state) => state.email);
  const isLoading = useAppStore((state) => state.isLoading);
  const isOnline = useAppStore((state) => state.isOnline);
  const outbox = useAppStore((state) => state.outbox);
  const setSession = useAppStore((state) => state.setSession);
  const setAuthUser = useAppStore((state) => state.setAuthUser);
  const setLoading = useAppStore((state) => state.setLoading);
  const setOnline = useAppStore((state) => state.setOnline);
  const setOutbox = useAppStore((state) => state.setOutbox);
  const resetStore = useAppStore((state) => state.reset);
  const wasOnline = useRef<boolean | null>(null);

  const clearSessionState = useCallback(() => {
    resetStore();
    setSentryUser(null);
  }, [resetStore]);

  const applySession = useCallback(
    async (result: Result<DomainSession | null>): Promise<Result<DomainSession>> => {
      if (!result.ok) {
        if (result.error.code === 'CORREO_NO_VERIFICADO' || result.error.code === 'CUENTA_INACTIVA') {
          clearSessionState();
        }
        return result;
      }

      const next = result.value ?? guestSession;
      const authUser = next.status === 'authenticated' ? await getCurrentAuthUser() : null;
      setSession(next);
      setAuthUser(authUser?.id ?? null, authUser?.email ?? null);
      return ok(next);
    },
    [clearSessionState, setAuthUser, setSession],
  );

  useEffect(() => {
    setSentryUser(status === 'authenticated' ? userId : null);
  }, [status, userId]);

  const refresh = useCallback(async (): Promise<Result<DomainSession>> => {
    try {
      const result = await dataContainer.repositories.auth.getCurrentSession();
      return await applySession(result);
    } finally {
      setLoading(false);
    }
  }, [applySession, setLoading]);

  useEffect(() => {
    const unsubscribeAuth = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSessionState();
        setLoading(false);
        return;
      }
      void refresh();
    });

    void Promise.resolve().then(() => {
      void refresh();
    });

    return () => {
      unsubscribeAuth.data.subscription.unsubscribe();
    };
  }, [clearSessionState, refresh, setLoading]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
        void dataContainer.outbox.flushPending();
        void flushSentryReports();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const applyNetworkState = (connected: boolean) => {
      const previous = wasOnline.current;
      wasOnline.current = connected;
      setOnline(connected);
      if (connected && previous === false) {
        void refresh();
        void dataContainer.outbox.flushPending();
        void flushSentryReports();
      }
    };

    void NetInfo.fetch().then((state) => {
      if (active) {
        applyNetworkState(Boolean(state.isConnected));
        void flushSentryReports();
      }
    });
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      applyNetworkState(Boolean(state.isConnected));
    });

    return () => {
      active = false;
      unsubscribeNetwork();
    };
  }, [refresh, setOnline]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const updateOutbox = async () => {
      const snapshot = await dataContainer.outbox.refreshSnapshot();
      if (snapshot) {
        setOutbox(snapshot);
      }
    };

    const unsubscribeOutbox = dataContainer.outbox.subscribe(() => {
      void updateOutbox();
    });

    void dataContainer.outbox.start().then(() => {
      void updateOutbox();
    });

    return () => {
      unsubscribeOutbox();
      dataContainer.outbox.stop();
    };
  }, [setOutbox, status]);

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
    return dataContainer.useCases.recoverPassword({ email: emailValue });
  }, []);

  const resendConfirmation = useCallback(async (emailValue: string) => {
    return dataContainer.repositories.auth.resendConfirmation(emailValue);
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    status,
    role,
    mustChangePassword,
    emailVerified,
    userId,
    email,
    isLoading,
    isOnline,
    outbox,
    refresh,
    signIn,
    signOut,
    changePassword,
    resetPassword,
    requestPasswordRecovery,
    resendConfirmation,
  }), [
    status,
    role,
    mustChangePassword,
    emailVerified,
    userId,
    email,
    isLoading,
    isOnline,
    outbox,
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
