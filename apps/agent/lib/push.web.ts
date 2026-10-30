import type { PushState } from './push';

/** The web preview has no push: notifications are a phone feature. */
export function usePush(_enabled: boolean): { state: PushState; openSettings: () => void } {
  return { state: 'unavailable', openSettings: () => {} };
}
