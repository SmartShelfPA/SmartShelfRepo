/**
 * TTS (Text-to-Speech) with fallbacks.
 * Uses expo-speech when available; falls back to Web Speech API on web
 * or when native module is not found (e.g. Expo Go, some environments).
 */
import { Platform } from 'react-native';

let expoSpeech: typeof import('expo-speech') | null = null;

function getExpoSpeech(): typeof import('expo-speech') | null {
  if (expoSpeech !== null) return expoSpeech;
  try {
    expoSpeech = require('expo-speech');
    return expoSpeech;
  } catch {
    expoSpeech = null;
    return null;
  }
}

function useWebSpeech(): boolean {
  return Platform.OS === 'web' || typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis;
}

export function speak(
  text: string,
  options?: {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  }
): void {
  const done = () => {
    options?.onDone?.();
    options?.onStopped?.();
  };

  if (useWebSpeech() && typeof globalThis !== 'undefined') {
    const synth = (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (synth) {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.onend = done;
      u.onerror = () => options?.onError?.();
      synth.speak(u);
      return;
    }
  }

  const Speech = getExpoSpeech();
  if (Speech) {
    try {
      Speech.speak(text, {
        onDone: done,
        onStopped: done,
        onError: () => options?.onError?.() ?? done(),
      });
    } catch {
      options?.onError?.();
    }
  } else {
    options?.onError?.();
  }
}

export function stop(): void {
  if (useWebSpeech() && typeof globalThis !== 'undefined') {
    const synth = (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (synth) synth.cancel();
    return;
  }
  try {
    getExpoSpeech()?.stop();
  } catch {
    // ignore
  }
}
