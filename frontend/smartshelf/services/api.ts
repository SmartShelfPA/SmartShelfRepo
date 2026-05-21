import { getDevApiBaseUrl } from '@/src/lib/devApiBaseUrl';
import { universalStorage } from '@/src/lib/universalStorage';

// Dev URL is chosen in getDevApiBaseUrl() (web / simulators / emulator / physical device).
// Override anytime: EXPO_PUBLIC_API_BASE_URL=https://your-tunnel.ngrok-free.dev/api
// Physical device fallback if Expo host is missing: EXPO_PUBLIC_DEV_API_HOST=192.168.1.5
// Optional port: EXPO_PUBLIC_DEV_API_PORT=8000
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (__DEV__ ? getDevApiBaseUrl() : 'https://your-production-api.com/api');

/** ngrok free tier: skip interstitial for programmatic requests */
export const getApiExtraHeaders = (): Record<string, string> =>
  API_BASE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {};

const REQUEST_TIMEOUT_MS = 10000;

/** Backend base URL (without /api) - used for PDF proxy */
export const getBackendBaseUrl = (): string => {
  const url = API_BASE_URL.replace(/\/api\/?$/, '');
  return url || API_BASE_URL;
};

const TOKEN_KEY = '@smartshelf:auth_token';
const PROFILE_KEY = '@smartshelf:user_profile';
const STAY_LOGGED_IN_KEY = '@smartshelf:stay_logged_in';

export type UserRole = 'student' | 'parent' | 'staff' | 'publisher';

export type SchoolOrganization = {
  id: string;
  name: string;
  slug: string;
  address: string;
  created_at: string;
};

export type RegisterPayload = {
  full_name: string;
  username: string;
  password: string;
  email: string;
  role: UserRole;
  date_of_birth?: string | null;
  student_class?: string;
  linked_student_username?: string;
  organization_slug?: string;
  staff_role?: string;
  staff_department?: string;
  company_name?: string;
  contact_email?: string;
};

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  date_of_birth?: string | null;
  student_class?: string;
  avatar_url?: string;
  staff_role?: string;
  staff_department?: string;
  managed_student_ids?: string[];
};

let sessionToken: string | null = null;
let sessionProfile: UserProfile | null = null;
let storageHydrated = false;

export type PublisherProfile = {
  id: string;
  companyName: string;
  contactEmail: string;
  isVerified: boolean;
  catalogSize: number;
};

export type Book = {
  id: string;
  publisherId?: string;
  isbn?: string;
  title: string;
  author: string;
  coverImageUrl: string;
  description: string;
  pageCount: number;
  category: string[];
};

export type ReadingProgress = {
  id: string;
  status: 'to-read' | 'reading' | 'completed';
  current_page: number;
  last_read_at: string;
  rating?: number | null;
  percent_complete: number;
};

export type BookshelfItem = {
  book: Book;
  progress: ReadingProgress;
};

async function hydrateSessionFromDisk(): Promise<void> {
  if (storageHydrated) return;
  storageHydrated = true;
  const stayLoggedIn = await universalStorage.getItem(STAY_LOGGED_IN_KEY);
  if (stayLoggedIn === 'false') return;
  const [token, profileRaw] = await Promise.all([
    universalStorage.getItem(TOKEN_KEY),
    universalStorage.getItem(PROFILE_KEY),
  ]);
  if (token) sessionToken = token;
  if (profileRaw) {
    try {
      sessionProfile = JSON.parse(profileRaw) as UserProfile;
    } catch {
      sessionProfile = null;
    }
  }
}

/** Load token/profile from device storage when stay logged in is enabled. */
export const hydrateAuthSession = async (): Promise<void> => {
  await hydrateSessionFromDisk();
};

export const getStayLoggedInPreference = async (): Promise<boolean> => {
  const value = await universalStorage.getItem(STAY_LOGGED_IN_KEY);
  return value !== 'false';
};

export const setStayLoggedInPreference = async (enabled: boolean): Promise<void> => {
  await universalStorage.setItem(STAY_LOGGED_IN_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await universalStorage.removeItem(TOKEN_KEY);
    await universalStorage.removeItem(PROFILE_KEY);
  }
};

export type PersistSessionOptions = {
  /** When false, session lasts until app restart only. Default true. */
  persist?: boolean;
};

export const getToken = async (): Promise<string | null> => {
  await hydrateSessionFromDisk();
  return sessionToken;
};

export const setToken = async (
  token: string,
  options: PersistSessionOptions = {}
): Promise<void> => {
  const persist = options.persist !== false;
  sessionToken = token;
  await setStayLoggedInPreference(persist);
  if (persist) {
    await universalStorage.setItem(TOKEN_KEY, token);
  } else {
    await universalStorage.removeItem(TOKEN_KEY);
  }
};

export const getStoredProfile = async (): Promise<UserProfile | null> => {
  await hydrateSessionFromDisk();
  return sessionProfile;
};

export const setStoredProfile = async (
  profile: UserProfile,
  options: PersistSessionOptions = {}
): Promise<void> => {
  const persist = options.persist !== false;
  sessionProfile = profile;
  if (persist) {
    await universalStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } else {
    await universalStorage.removeItem(PROFILE_KEY);
  }
};

/** Clears session and persisted auth keys. */
export const removeToken = async (): Promise<void> => {
  sessionToken = null;
  sessionProfile = null;
  storageHydrated = false;
  await universalStorage.removeItem(TOKEN_KEY);
  await universalStorage.removeItem(PROFILE_KEY);
  await universalStorage.removeItem(STAY_LOGGED_IN_KEY);
};

/** Remove disk-only auth keys without clearing in-memory session. */
export const clearPersistedAuthFromDisk = async (): Promise<void> => {
  await universalStorage.removeItem(TOKEN_KEY);
  await universalStorage.removeItem(PROFILE_KEY);
};

/**
 * Check if user has a valid token stored
 */
export const hasValidToken = async (): Promise<boolean> => {
  try {
    const token = await getToken();
    if (!token) {
      return false;
    }
    
    // Optionally validate token with backend
    // For now, just check if token exists
    return true;
  } catch (error) {
    console.error('Error checking token:', error);
    return false;
  }
};

/**
 * Make API request with authentication
 */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getApiExtraHeaders(),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`[API] ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Validate token with backend
 */
export const validateToken = async (): Promise<boolean> => {
  try {
    const token = await getToken();
    if (!token) {
      return false;
    }

    const response = await apiRequest('/auth/validate/', {
      method: 'GET',
    });

    return response.ok;
  } catch (error) {
    console.error('[API] Token validation error:', error);
    return false;
  }
};

/**
 * Login user
 */
export const login = async (
  username: string,
  password: string,
  options: PersistSessionOptions = {}
) => {
  console.log('[API] Login request initiated for username:', username);
  
  try {
    const response = await apiRequest('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    console.log('[API] Login response status:', response.status);

    if (!response.ok) {
      console.error('[API] Login failed:', data);
      throw new Error(data.error || 'Login failed');
    }

    console.log('[API] Login successful, token received');
    const persist = options?.persist !== false;
    await setToken(data.token, { persist });
    if (data.user) {
      await setStoredProfile(data.user, { persist });
    }
    
    return data;
  } catch (error) {
    console.error('[API] Login error:', error);
    throw error;
  }
};

function formatApiValidationErrors(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return 'Registration failed';
  }
  const d = data as Record<string, unknown>;
  if (typeof d.detail === 'string') return d.detail;
  if (typeof d.error === 'string') return d.error;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(d)) {
    if (key === 'success') continue;
    if (Array.isArray(value)) {
      parts.push(`${key}: ${value.join(' ')}`);
    } else if (value && typeof value === 'object') {
      const nested = formatApiValidationErrors(value);
      if (nested) parts.push(nested);
    } else if (typeof value === 'string') {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join(' · ') || 'Registration failed';
}

/** Schools listed on the registration screen (public endpoint, no auth). */
export const fetchOrganizations = async (): Promise<SchoolOrganization[]> => {
  const root = API_BASE_URL.replace(/\/+$/, '');
  const url = `${root}/auth/organizations/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...getApiExtraHeaders() },
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    throw new Error(
      `Could not reach SmartShelf API (${url}). Check EXPO_PUBLIC_API_BASE_URL. ${msg}`
    );
  } finally {
    clearTimeout(timeout);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Could not load schools (invalid response).');
  }
  if (!response.ok) {
    const msg =
      data && typeof data === 'object' && typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : `Could not load schools (${response.status}).`;
    throw new Error(msg);
  }
  if (!Array.isArray(data)) {
    throw new Error('Could not load schools (unexpected response).');
  }
  return data as SchoolOrganization[];
};

/**
 * Register new user (all roles; payload must satisfy backend rules).
 */
export const register = async (
  payload: RegisterPayload,
  options: PersistSessionOptions = { persist: true }
) => {
  const { full_name, username, password, email, role } = payload;
  console.log('[API] Register request initiated for username:', username);

  const body: Record<string, unknown> = {
    full_name,
    username,
    password,
    email,
    role,
  };

  const dob = payload.date_of_birth?.trim();
  body.date_of_birth = dob && dob.length > 0 ? dob : null;

  if (role === 'publisher') {
    body.company_name = payload.company_name?.trim() ?? '';
    body.contact_email = payload.contact_email?.trim() ?? '';
  } else {
    body.organization_slug = payload.organization_slug?.trim() ?? '';
    body.student_class = payload.student_class?.trim() ?? '';
    body.linked_student_username = payload.linked_student_username?.trim() ?? '';
    body.staff_role = payload.staff_role?.trim() ?? '';
    body.staff_department = payload.staff_department?.trim() ?? '';
  }

  try {
    const response = await apiRequest('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[API] Register response status:', response.status);

    if (!response.ok) {
      console.error('[API] Register failed:', data);
      throw new Error(formatApiValidationErrors(data));
    }

    console.log('[API] Registration successful, token received');
    const persist = options.persist !== false;
    await setToken(data.token, { persist });
    if (data.user) {
      await setStoredProfile(data.user, { persist });
    }

    return data;
  } catch (error) {
    console.error('[API] Register error:', error);
    throw error;
  }
};

export type PasswordResetRequestResult = {
  message: string;
  debugResetCode?: string;
};

export const requestPasswordResetCode = async (
  email: string
): Promise<PasswordResetRequestResult> => {
  const response = await apiRequest('/auth/password-reset/request/', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim() }),
  });
  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // ignore parse errors and throw fallback below
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : 'Failed to send reset code';
    throw new Error(message);
  }
  return {
    message:
      data && typeof data.message === 'string'
        ? data.message
        : 'If that email exists, a reset code has been sent.',
    debugResetCode:
      data && typeof data.debug_reset_code === 'string' ? data.debug_reset_code : undefined,
  };
};

export const confirmPasswordReset = async (
  email: string,
  code: string,
  newPassword: string
): Promise<void> => {
  const response = await apiRequest('/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      code: code.trim(),
      new_password: newPassword,
    }),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // ignore parse errors and throw fallback below
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : 'Failed to reset password';
    throw new Error(message);
  }
};

function profileErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (typeof o.error === 'string' && o.error) return o.error;
    if (typeof o.detail === 'string' && o.detail) return o.detail;
  }
  if (status === 401) {
    return 'Session expired. Sign in again.';
  }
  if (status === 404) {
    return 'Profile not found on the server.';
  }
  return `Failed to fetch profile (${status})`;
}

export const getProfile = async (): Promise<UserProfile | PublisherProfile> => {
  const token = await getToken();
  if (!token) {
    throw new Error('Not signed in');
  }

  const response = await apiRequest('/v1/profile/');
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(profileErrorMessage(data, response.status));
  }
  if (data && typeof data === 'object' && 'username' in data) {
    await setStoredProfile(data as UserProfile, { persist: true });
  }
  return data as UserProfile | PublisherProfile;
};

export const fetchBooks = async (_params?: {
  search?: string;
  category?: string;
}): Promise<Book[]> => {
  return [];
};

export const fetchBookshelf = async (): Promise<BookshelfItem[]> => {
  const response = await apiRequest('/v1/bookshelf/');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch bookshelf');
  }
  return data as BookshelfItem[];
};

