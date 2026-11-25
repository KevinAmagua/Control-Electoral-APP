import { create } from 'zustand';

import type { OutboxSnapshot } from '@/data/local/sqliteClient';
import type { Session as DomainSession } from '@/domain/auth/session';

export const EMPTY_OUTBOX_SNAPSHOT: OutboxSnapshot = {
  pending: 0,
  inProgress: 0,
  saved: 0,
  failed: 0,
  conflicts: 0,
  updatedAt: '',
};

type AppState = DomainSession & {
  userId: string | null;
  email: string | null;
  isLoading: boolean;
  isOnline: boolean;
  outbox: OutboxSnapshot;
  setSession: (session: DomainSession) => void;
  setAuthUser: (userId: string | null, email: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setOnline: (isOnline: boolean) => void;
  setOutbox: (outbox: OutboxSnapshot) => void;
  reset: () => void;
};

const guestSession: DomainSession = {
  status: 'guest',
  role: null,
  mustChangePassword: false,
  emailVerified: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...guestSession,
  userId: null,
  email: null,
  isLoading: true,
  isOnline: true,
  outbox: EMPTY_OUTBOX_SNAPSHOT,
  setSession: (session) => set(session),
  setAuthUser: (userId, email) => set({ userId, email }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnline: (isOnline) => set({ isOnline }),
  setOutbox: (outbox) => set({ outbox }),
  reset: () =>
    set({
      ...guestSession,
      userId: null,
      email: null,
      isLoading: false,
      outbox: EMPTY_OUTBOX_SNAPSHOT,
    }),
}));
