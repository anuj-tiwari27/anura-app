import { create } from 'zustand';
import type { AuthResponse, PublicUser } from '@anura/shared';
import { api, tokenStore } from './api-client';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: PublicUser | null;
  status: AuthStatus;
  /** Store tokens + user after a login/signup response. */
  setSession: (res: AuthResponse) => void;
  /** Fetch the current user using the stored access token (on app load). */
  loadMe: () => Promise<void>;
  /** Patch the cached user (e.g. after onboarding). */
  patchUser: (patch: Partial<PublicUser>) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',

  setSession: (res) => {
    tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
    set({ user: res.user, status: 'authenticated' });
  },

  loadMe: async () => {
    if (!tokenStore.access) {
      set({ status: 'unauthenticated', user: null });
      return;
    }
    set({ status: 'loading' });
    try {
      const user = await api.get<PublicUser>('/users/me');
      set({ user, status: 'authenticated' });
    } catch {
      tokenStore.clear();
      set({ user: null, status: 'unauthenticated' });
    }
  },

  patchUser: (patch) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...patch } });
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null, status: 'unauthenticated' });
  },
}));
