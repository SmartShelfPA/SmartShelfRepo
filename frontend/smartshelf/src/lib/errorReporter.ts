/**
 * errorReporter.ts
 *
 * Lightweight client-side crash/error reporter.
 *
 * What it does:
 *  1. Stores up to 20 crash entries in AsyncStorage so they survive app restarts.
 *  2. In development: also logs to the console.
 *  3. In production: optionally POSTs to the backend /api/v1/crash-report/ endpoint
 *     if EXPO_PUBLIC_CRASH_REPORTING_ENABLED=true is set in the environment.
 *
 * No external crash service (Sentry, Bugsnag, etc.) is required — all state is
 * local. Drop in a third-party SDK later by adding a call inside `sendToBackend`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'smartshelf:crash_log';
const MAX_ENTRIES = 20;
const REPORTING_ENABLED =
  process.env.EXPO_PUBLIC_CRASH_REPORTING_ENABLED === 'true';

export type CrashEntry = {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  context?: string;
  platform: string;
  appVersion: string;
};

function buildEntry(error: unknown, context?: string): CrashEntry {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
    context,
    platform: Platform.OS,
    appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? 'unknown',
  };
}

async function persist(entry: CrashEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: CrashEntry[] = raw ? (JSON.parse(raw) as CrashEntry[]) : [];
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage failure must never throw — we're already in an error path.
  }
}

async function sendToBackend(entry: CrashEntry): Promise<void> {
  if (!REPORTING_ENABLED) return;
  try {
    const { apiRequest } = await import('@/services/api');
    await apiRequest('/v1/crash-report/', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  } catch {
    // Network failure is expected when the app crashes — ignore silently.
  }
}

/** Report an error (from an ErrorBoundary, a try/catch, or a global handler). */
export async function reportError(error: unknown, context?: string): Promise<void> {
  const entry = buildEntry(error, context);

  if (__DEV__) {
    console.error(`[CrashReporter] ${context ?? 'Uncaught error'}:`, error);
  }

  await persist(entry);
  await sendToBackend(entry);
}

/** Return stored crash entries (useful for a "Diagnostics" dev screen). */
export async function getStoredCrashes(): Promise<CrashEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CrashEntry[]) : [];
  } catch {
    return [];
  }
}

/** Clear all stored crash entries. */
export async function clearStoredCrashes(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Install global handlers for unhandled JS exceptions and promise rejections. */
export function installGlobalErrorHandlers(): void {
  // React Native exposes ErrorUtils for unhandled JS exceptions.
  if (typeof ErrorUtils !== 'undefined') {
    const prev = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      void reportError(error, isFatal ? 'fatal_global' : 'global');
      prev?.(error, isFatal);
    });
  }

  // Web only: unhandled promise rejections.
  // Guard carefully — React Native has a `global` but no real `window.addEventListener`.
  if (
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function'
  ) {
    window.addEventListener('unhandledrejection', (event) => {
      void reportError(event.reason, 'unhandled_promise');
    });
  }
}
