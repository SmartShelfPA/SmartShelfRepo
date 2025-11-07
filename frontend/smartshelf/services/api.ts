import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend API base URL - adjust this to match your backend server
// For Android emulator, use: http://10.0.2.2:8000/api
// For iOS simulator, use: http://localhost:8000/api
// For physical device, use your computer's IP address: http://YOUR_IP:8000/api
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api'  // Development - adjust for your setup
  : 'https://your-production-api.com/api';  // Production URL

// Token storage key
const TOKEN_KEY = '@smartshelf:auth_token';

/**
 * Get stored authentication token
 */
export const getToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

/**
 * Store authentication token
 */
export const setToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    console.log('Token stored successfully');
  } catch (error) {
    console.error('Error storing token:', error);
    throw error;
  }
};

/**
 * Remove authentication token
 */
export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    console.log('Token removed successfully');
  } catch (error) {
    console.error('Error removing token:', error);
    throw error;
  }
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
const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`[API] ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
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
  name: string,
  username: string,
  password: string,
  email: string,
  date_of_birth: string
) => {
  console.log('[API] Register request initiated for username:', username);
  
  try {
    const response = await apiRequest('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({
        name,
        username,
        password,
        email,
        date_of_birth,
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
    
    return data;
  } catch (error) {
    console.error('[API] Register error:', error);
    throw error;
  }
};

