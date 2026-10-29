import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { klyr } from './klyr';

// Show visit pushes even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export type PushState = 'checking' | 'on' | 'off' | 'unavailable';

/**
 * Registers this phone for deal, offer and visit pushes once the buyer is signed in. The token is tied to this
 * sign-in on the server, so signing out stops the pushes without another call.
 */
export function usePush(enabled: boolean): { state: PushState; openSettings: () => void } {
  const [state, setState] = useState<PushState>('checking');
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      if (Platform.OS === 'web') return setState('unavailable');
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('visits', { name: 'Visits', importance: Notifications.AndroidImportance.HIGH });
      }
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) return setState('off');
      // EAS project id: set when the app is linked to EAS (eas init); without it there is no push token.
      const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return setState('unavailable');
      try {
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        const r = await klyr.registerDevice(data, Platform.OS === 'ios' ? 'ios' : 'android');
        setState(r.ok ? 'on' : 'unavailable');
      } catch {
        setState('unavailable');
      }
    })();
  }, [enabled]);

  // Tapping a push opens its screen: your deal, offers or visits.
  useEffect(() => {
    const screen = last?.notification.request.content.data?.screen;
    if (enabled && (screen === 'deal' || screen === 'offers' || screen === 'visits' || screen === 'searches' || screen === 'sell' || screen === 'rent')) router.push(`/${screen}`);
  }, [enabled, last]);

  return { state, openSettings: () => void Linking.openSettings() };
}
