import { useCallback, useEffect, useState } from 'react';

import { dataContainer } from '@/data/container';
import { captureError } from '@/data/monitoring/sentry';
import type { UserProfile } from '@/domain/user/profile';
import { useSession } from '@/presentation/session/SessionProvider';

type SessionExtras = {
  userId?: string | null;
  email?: string | null;
  isLoading?: boolean;
};

export function useActorSession() {
  const baseSession = useSession();
  const session = baseSession as typeof baseSession & SessionExtras;
  const [actorId, setActorId] = useState<string | null>(session.userId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const setResolution = useCallback((actor: string | null, message: string | null, pending: boolean) => {
    void Promise.resolve().then(() => {
      setActorId(actor);
      setError(message);
      setResolving(pending);
    });
  }, []);

  useEffect(() => {
    let active = true;
    setResolution(null, null, false);

    if (session.userId) {
      setResolution(session.userId, null, false);
      return;
    }

    if (!session.email) {
      setResolution(null, 'La sesión no incluye un usuario válido.', false);
      return;
    }

    setResolution(null, null, true);
    void dataContainer.repositories.users.getByEmail(session.email).then((result) => {
      if (!active) {
        return;
      }
      if (result.ok && result.value) {
        setResolution(result.value.id, null, false);
      } else {
        if (!result.ok) {
          captureError(new Error(result.error.code), { scope: 'session.resolveActorByEmail' });
        }
        setResolution(null, result.ok ? 'No se encontró el perfil de la sesión.' : result.error.message, false);
      }
    });

    return () => {
      active = false;
    };
  }, [session.email, session.userId, setResolution]);

  return {
    session,
    actorId,
    isLoading: (session.isLoading ?? false) || resolving,
    error,
  };
}

export function useActorProfile() {
  const { session, actorId, isLoading: isSessionLoading, error: sessionError } = useActorSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const clearProfile = useCallback(() => {
    void Promise.resolve().then(() => {
      setProfile(null);
      setLoading(false);
    });
  }, []);

  const startProfileLoading = useCallback(() => {
    void Promise.resolve().then(() => setLoading(true));
  }, []);

  useEffect(() => {
    let active = true;

    if (!actorId) {
      clearProfile();
      return;
    }

    startProfileLoading();
    void dataContainer.repositories.users.getById(actorId).then((result) => {
      if (!active) {
        return;
      }
      if (result.ok && result.value) {
        setProfile(result.value);
        setError(null);
      } else {
        if (!result.ok) {
          captureError(new Error(result.error.code), { scope: 'session.loadActorProfile' });
        }
        setProfile(null);
        setError(result.ok ? 'No se encontró el perfil del usuario.' : result.error.message);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [actorId, reloadToken, clearProfile, startProfileLoading]);

  const refresh = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return {
    session,
    actorId,
    profile,
    isLoading: isSessionLoading || loading,
    error: sessionError ?? error,
    refresh,
  };
}
