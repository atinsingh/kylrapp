import Constants from 'expo-constants';
import { createClient } from '@klyr/api-client';
import { tokenStore } from './storage';

/** EXPO_PUBLIC_API_URL wins; in development, use the machine running Expo on port 4000. */
function apiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}

let token: string | null | undefined;
const listeners = new Set<(signedIn: boolean) => void>();

export const klyr = createClient({
  baseUrl: apiUrl(),
  getToken: async () => (token === undefined ? (token = await tokenStore.get()) : token),
  onToken: async t => {
    token = t;
    await tokenStore.set(t);
    listeners.forEach(l => l(!!t));
  },
});

export const hasToken = async () => !!(token === undefined ? (token = await tokenStore.get()) : token);
export const onTokenChange = (l: (signedIn: boolean) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export { errorText } from '@klyr/api-client';
