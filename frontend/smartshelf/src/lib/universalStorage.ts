import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage-backed persistence for Zustand and legacy auth key cleanup.
 * Matches zustand persist StateStorage (async get/set/remove).
 */
export const universalStorage = {
  getItem: (name: string) => AsyncStorage.getItem(name),
  setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
  removeItem: (name: string) => AsyncStorage.removeItem(name),
};
