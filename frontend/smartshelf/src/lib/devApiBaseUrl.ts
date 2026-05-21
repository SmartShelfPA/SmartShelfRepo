import { Platform } from 'react-native';

/**
 * Dev-only API base when `EXPO_PUBLIC_API_BASE_URL` is not set.
 * Set `EXPO_PUBLIC_DEV_API_HOST` for a physical device on LAN.
 */
export function getDevApiBaseUrl(): string {
  const port = process.env.EXPO_PUBLIC_DEV_API_PORT ?? '8000';
  const host = process.env.EXPO_PUBLIC_DEV_API_HOST?.trim();
  if (host) {
    return `http://${host}:${port}/api`;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${port}/api`;
  }
  return `http://localhost:${port}/api`;
}
