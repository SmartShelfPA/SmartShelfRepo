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
  type LoginPortal,
  type RegisterPayload,
  UserProfile,
} from '@/services/api';
import { getHomeHref } from '@/src/lib/navigation';
import { clearReturnTo } from '@/src/lib/returnTo';
import {
  clearPortalChoice,
  getPortalChoice,
  setPortalChoice,
  type PortalChoice,
} from '@/src/lib/portalChoice';

/** `signin` is set only by a fresh sign-in or registration, never by restoring a saved session. */
export type NavTutorialRequest = 'off' | 'signin' | 'replay';

type AuthState = {
  token: string | null;
  user: UserProfile | null;
  portalChoice: PortalChoice | null;
  isHydrating: boolean;
  isAuthenticated: boolean;
  navTutorialRequest: NavTutorialRequest;
  initialize: () => Promise<void>;
  choosePortal: (choice: PortalChoice) => Promise<void>;
  signIn: (
    username: string,
    password: string,
    options?: { stayLoggedIn?: boolean; portal?: LoginPortal }
  ) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: (options?: { keepReturnTo?: boolean }) => Promise<void>;
  openNavTutorial: () => void;
  closeNavTutorial: () => void;
  getHomeRoute: () => Href;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  portalChoice: null,
  isHydrating: true,
  isAuthenticated: false,
  navTutorialRequest: 'off',

  initialize: async () => {
    set({ isHydrating: true });

    const run = async () => {
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
    };

    const timeoutMs = 12000;
    try {
      await Promise.race([
        run(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, timeoutMs);
        }),
      ]);
    } catch (error) {
      console.error('[Auth] initialize failed:', error);
      set({ token: null, user: null, isAuthenticated: false });
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
    const result = await login(username, password, { persist, portal: options?.portal });
    const token = result?.token ?? (await getToken());
    const user = result?.user ?? (await getStoredProfile());
    set({ token, user, isAuthenticated: true, navTutorialRequest: 'signin' });
  },

  signUp: async (payload) => {
    const result = await register(payload, { persist: true });
    const token = result?.token ?? (await getToken());
    const user = result?.user ?? (await getStoredProfile());
    set({ token, user, isAuthenticated: true, navTutorialRequest: 'signin' });
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

  signOut: async (options) => {
    if (!options?.keepReturnTo) clearReturnTo();
    await removeToken();
    await clearPortalChoice();
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      portalChoice: null,
      navTutorialRequest: 'off',
    });
  },

  openNavTutorial: () => set({ navTutorialRequest: 'replay' }),

  closeNavTutorial: () => set({ navTutorialRequest: 'off' }),

  getHomeRoute: () => {
    const { user, portalChoice } = get();
    return getHomeHref({ portal: portalChoice, role: user?.role });
  },
}));
