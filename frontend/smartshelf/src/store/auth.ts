import type { Href } from 'expo-router';
import { create } from 'zustand';

import {
  getProfile,
  getStoredProfile,
  getToken,
  hydrateAuthSession,
  login,
  register,
  removeToken,
  setStoredProfile,
  validateToken,
  type RegisterPayload,
  UserProfile,
} from '@/services/api';
import { getHomeHref } from '@/src/lib/navigation';
import {
  clearPortalChoice,
  getPortalChoice,
  setPortalChoice,
  type PortalChoice,
} from '@/src/lib/portalChoice';

type AuthState = {
  token: string | null;
  user: UserProfile | null;
  portalChoice: PortalChoice | null;
  isHydrating: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  choosePortal: (choice: PortalChoice) => Promise<void>;
  signIn: (username: string, password: string, options?: { stayLoggedIn?: boolean }) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  getHomeRoute: () => Href;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  portalChoice: null,
  isHydrating: true,
  isAuthenticated: false,

  initialize: async () => {
    set({ isHydrating: true });
    try {
      const portalChoice = await getPortalChoice();
      await hydrateAuthSession();
      const token = await getToken();
      if (!token) {
        set({ token: null, user: null, isAuthenticated: false, portalChoice });
        return;
      }

      const valid = await validateToken();
      if (!valid) {
        await removeToken();
        set({ token: null, user: null, isAuthenticated: false, portalChoice });
        return;
      }

      let user = await getStoredProfile();
      try {
        const profile = await getProfile();
        if (profile && typeof profile === 'object' && 'username' in profile) {
          user = profile as UserProfile;
          await setStoredProfile(user, { persist: true });
        }
      } catch {
        // Keep cached profile when offline or profile endpoint fails.
      }

      set({ token, user, isAuthenticated: true, portalChoice });
    } finally {
      set({ isHydrating: false });
    }
  },

  choosePortal: async (choice) => {
    await setPortalChoice(choice);
    set({ portalChoice: choice });
  },

  signIn: async (username, password, options) => {
    const persist = options?.stayLoggedIn !== false;
    const result = await login(username, password, { persist });
    const token = result?.token ?? (await getToken());
    const user = result?.user ?? (await getStoredProfile());
    set({ token, user, isAuthenticated: true });
  },

  signUp: async (payload) => {
    const result = await register(payload, { persist: true });
    const token = result?.token ?? (await getToken());
    const user = result?.user ?? (await getStoredProfile());
    set({ token, user, isAuthenticated: true });
  },

  refreshProfile: async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const profile = await getProfile();
      if (profile && typeof profile === 'object' && 'username' in profile) {
        await setStoredProfile(profile, { persist: true });
        set({ user: profile });
      }
    } catch {
      // Profile tab may call this while offline; keep cached user from login.
    }
  },

  signOut: async () => {
    await removeToken();
    await clearPortalChoice();
    set({ token: null, user: null, isAuthenticated: false, portalChoice: null });
  },

  getHomeRoute: () => {
    const { user, portalChoice } = get();
    return getHomeHref({ portal: portalChoice, role: user?.role });
  },
}));
