import { universalStorage } from '@/src/lib/universalStorage';

// Backend API base URL - adjust this to match your backend server
// For Android emulator: http://10.0.2.2:8000/api
// For iOS simulator: http://localhost:8000/api
// For physical device: http://YOUR_MACHINE_IP:8000/api (e.g. http://192.168.1.5:8000/api)
const DEFAULT_LOCAL_API_BASE_URL = 'http://127.0.0.1:8000/api';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (__DEV__ ? DEFAULT_LOCAL_API_BASE_URL : 'https://your-production-api.com/api');

const REQUEST_TIMEOUT_MS = 10000;

/** Backend base URL (without /api) - used for PDF proxy */
export const getBackendBaseUrl = (): string => {
  const url = API_BASE_URL.replace(/\/api\/?$/, '');
  return url || API_BASE_URL;
};

// Legacy disk keys (cleared on sign-out / startup; session token is in-memory only)
const TOKEN_KEY = '@smartshelf:auth_token';
const PROFILE_KEY = '@smartshelf:user_profile';

export type UserRole = 'student' | 'parent' | 'staff' | 'publisher';

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  date_of_birth?: string | null;
  avatar_url?: string;
  staff_role?: string;
  staff_department?: string;
  managed_student_ids?: string[];
};

let sessionToken: string | null = null;
let sessionProfile: UserProfile | null = null;

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

/**
 * Session token (memory only — reload requires sign-in again).
 */
export const getToken = async (): Promise<string | null> => sessionToken;

export const setToken = async (token: string): Promise<void> => {
  sessionToken = token;
};

export const getStoredProfile = async (): Promise<UserProfile | null> => sessionProfile;

export const setStoredProfile = async (profile: UserProfile): Promise<void> => {
  sessionProfile = profile;
};

/**
 * Clears session and any legacy persisted auth keys (native + web).
 */
export const removeToken = async (): Promise<void> => {
  sessionToken = null;
  sessionProfile = null;
  await universalStorage.removeItem(TOKEN_KEY);
  await universalStorage.removeItem(PROFILE_KEY);
};

/** Remove disk-only auth keys (e.g. after upgrade from persisted-token builds). */
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
export const login = async (username: string, password: string) => {
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
    await setToken(data.token);
    if (data.user) {
      await setStoredProfile(data.user);
    }
    
    return data;
  } catch (error) {
    console.error('[API] Login error:', error);
    throw error;
  }
};

/**
 * Register new user
 */
export const register = async (
  full_name: string,
  username: string,
  password: string,
  email: string,
  date_of_birth: string,
  organization_slug = 'default-school',
  role: UserRole = 'student'
) => {
  console.log('[API] Register request initiated for username:', username);
  
  try {
    const response = await apiRequest('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({
        full_name,
        username,
        password,
        email,
        date_of_birth,
        organization_slug,
        role,
      }),
    });

    const data = await response.json();
    console.log('[API] Register response status:', response.status);

    if (!response.ok) {
      console.error('[API] Register failed:', data);
      throw new Error(data.error || 'Registration failed');
    }

    console.log('[API] Registration successful, token received');
    await setToken(data.token);
    if (data.user) {
      await setStoredProfile(data.user);
    }
    
    return data;
  } catch (error) {
    console.error('[API] Register error:', error);
    throw error;
  }
};

export const getProfile = async (): Promise<UserProfile | PublisherProfile> => {
  const response = await apiRequest('/v1/profile/');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch profile');
  }
  if ('username' in data) {
    await setStoredProfile(data as UserProfile);
  }
  return data;
};

export const fetchBooks = async (params?: {
  search?: string;
  category?: string;
}): Promise<Book[]> => {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.category) query.set('category', params.category);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await apiRequest(`/v1/books/${suffix}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch books');
  }
  return data as Book[];
};

export const fetchBookshelf = async (): Promise<BookshelfItem[]> => {
  const response = await apiRequest('/v1/bookshelf/');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch bookshelf');
  }
  return data as BookshelfItem[];
};

