/**
 * useGoogleSignIn
 *
 * Runs the Google OAuth flow using ONLY expo-web-browser + expo-linking.
 * We deliberately avoid `expo-auth-session` because it imports `expo-crypto`
 * (the ExpoCrypto native module) at load time, which crashes in Expo Go and in
 * dev-client builds that were compiled before expo-crypto was added.
 *
 * Flow:
 *  1. Build the Google authorization URL (response_type=code, no PKCE).
 *  2. Open it through the Expo auth proxy so Google can redirect to a valid
 *     https URL, which then deep-links back into the app.
 *  3. Parse the `code` from the returned URL.
 *  4. POST { code, redirect_uri } to the SmartShelf backend, which exchanges
 *     the code for an id_token (using the client secret), verifies it, and
 *     returns a SmartShelf DRF token.
 *
 * ── Setup needed ───────────────────────────────────────────────────────────
 *  Frontend .env:  EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=xxx.apps.googleusercontent.com
 *  Backend  .env:  GOOGLE_CLIENT_ID_WEB=xxx.apps.googleusercontent.com
 *                  GOOGLE_CLIENT_SECRET_WEB=GOCSPX-xxxx
 *  Google Cloud Console → Web client → Authorised redirect URIs:
 *                  https://auth.expo.io/@adesol/smartshelf
 * ───────────────────────────────────────────────────────────────────────────
 */

import { useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { useAuthStore } from '@/src/store/auth';
import { apiRequest, setToken, setStoredProfile, UserProfile } from '@/services/api';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? '';
const CLIENTS_CONFIGURED = Boolean(WEB_CLIENT_ID);

// Expo auth proxy redirect — must be registered in Google Cloud Console.
const EXPO_USERNAME = 'adesol';
const EXPO_SLUG = 'smartshelf';
const PROXY_REDIRECT = `https://auth.expo.io/@${EXPO_USERNAME}/${EXPO_SLUG}`;

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

export type GoogleSignInResult =
  | { success: true }
  | { success: false; error: string; code?: string };

export function useGoogleSignIn() {
  const setAuth = useAuthStore.setState;

  const signInWithGoogle = useCallback(async (): Promise<GoogleSignInResult> => {
    if (!CLIENTS_CONFIGURED) {
      return {
        success: false,
        error: 'Google Sign-In is not yet configured. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB in your .env file.',
        code: 'not_configured',
      };
    }

    try {
      // Deep link the proxy returns to after Google completes.
      const returnUrl = Linking.createURL('googleauth');

      const authParams = new URLSearchParams({
        client_id: WEB_CLIENT_ID,
        redirect_uri: PROXY_REDIRECT,
        response_type: 'code',
        scope: 'openid profile email',
        prompt: 'select_account',
        access_type: 'offline',
      });
      const authUrl = `${GOOGLE_AUTH_ENDPOINT}?${authParams.toString()}`;

      // The Expo proxy wraps the auth URL and forwards back to returnUrl.
      const startParams = new URLSearchParams({ authUrl, returnUrl });
      const startUrl = `${PROXY_REDIRECT}/start?${startParams.toString()}`;

      const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { success: false, error: 'Sign-in was cancelled.', code: 'cancelled' };
      }

      if (result.type !== 'success' || !result.url) {
        return { success: false, error: 'Google sign-in did not complete.', code: 'no_result' };
      }

      const parsed = Linking.parse(result.url);
      const authCode = parsed.queryParams?.code;
      const oauthError = parsed.queryParams?.error;

      if (oauthError) {
        return {
          success: false,
          error: typeof oauthError === 'string' ? oauthError : 'Google authentication failed.',
          code: 'oauth_error',
        };
      }

      if (!authCode || typeof authCode !== 'string') {
        return { success: false, error: 'No authorization code returned by Google.', code: 'no_code' };
      }

      // Backend exchanges the code for an id_token using the client secret.
      const backendResponse = await apiRequest('/auth/google/', {
        method: 'POST',
        body: JSON.stringify({
          code: authCode,
          redirect_uri: PROXY_REDIRECT,
          platform: Platform.OS,
        }),
      });

      const data = (await backendResponse.json().catch(() => ({}))) as Record<string, unknown>;

      if (!backendResponse.ok) {
        return {
          success: false,
          error: (data.error as string) ?? (data.message as string) ?? 'Google sign-in failed.',
          code: 'backend_error',
        };
      }

      const token = data.token as string;
      const user = data.user as UserProfile;
      await setToken(token, { persist: true });
      if (user) await setStoredProfile(user, { persist: true });
      setAuth({ token, user, isAuthenticated: true });

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
        code: 'exception',
      };
    }
  }, [setAuth]);

  return {
    signInWithGoogle,
    isConfigured: CLIENTS_CONFIGURED,
  };
}
