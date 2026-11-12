import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * The session token lives in the iOS Keychain / Android Keystore. The web build is only a
 * design preview, so it falls back to sessionStorage there.
 */
const KEY = 'klyr.pro.session';

export const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(KEY) ?? null;
    return SecureStore.getItemAsync(KEY);
  },
  async set(token: string | null): Promise<void> {
    if (Platform.OS === 'web') {
      if (token) globalThis.sessionStorage?.setItem(KEY, token); else globalThis.sessionStorage?.removeItem(KEY);
      return;
    }
    if (token) await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(KEY);
  },
};
