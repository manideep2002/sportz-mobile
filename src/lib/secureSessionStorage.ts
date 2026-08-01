import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { SupportedStorage } from '@supabase/supabase-js';

const options: SecureStore.SecureStoreOptions = {
  keychainService: 'sportz.auth',
  // Sessions remain available for token refresh after the device's first unlock,
  // but do not migrate to a different device through an iOS backup.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
};

/**
 * Supabase storage adapter for native platforms.
 *
 * The first read migrates a legacy AsyncStorage session to encrypted platform
 * storage and removes the plaintext copy only after the secure write succeeds.
 */
export const secureSessionStorage: SupportedStorage = {
  async getItem(key) {
    const secureValue = await SecureStore.getItemAsync(key, options);
    if (secureValue !== null) return secureValue;

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) return null;

    await SecureStore.setItemAsync(key, legacyValue, options);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },

  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value, options);
    // A successful sign-in/token refresh completes the migration even if a
    // legacy session was never read (for example after a direct sign-in).
    await AsyncStorage.removeItem(key);
  },

  async removeItem(key) {
    await SecureStore.deleteItemAsync(key, options);
    await AsyncStorage.removeItem(key);
  }
};
