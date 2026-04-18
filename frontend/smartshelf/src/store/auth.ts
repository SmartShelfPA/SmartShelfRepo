import { create } from 'zustand';

import {
  getProfile,
  getToken,
  login,
  register,
  removeToken,
  setStoredProfile,
  type RegisterPayload,
  UserProfile,
} from '@/services/api';

type AuthState = {
  token: string | null;
  user: UserProfile | null;
  isHydrating: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isHydrating: false,
  isAuthenticated: false,

  initialize: async () => {
    set({ isHydrating: false });
  },

  signIn: async (username, password) => {
    const result = await login(username, password);
    const token = result?.token ?? (await getToken());
    const user = result?.user ?? null;
    set({ token, user, isAuthenticated: true });
  },

  signUp: async (payload) => {
    const result = await register(payload);
    const token = result?.token ?? (await getToken());
    const user = result?.user ?? null;
    set({ token, user, isAuthenticated: true });
  },

  refreshProfile: async () => {
    const profile = await getProfile();
    if ('username' in profile) {
      await setStoredProfile(profile);
      set({ user: profile });
    }
  },

  signOut: async () => {
    await removeToken();
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
