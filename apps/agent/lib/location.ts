import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { GeoReading } from '@klyr/api-client';

export class LocationError extends Error {}

/** Asks once for "while using the app" location; Klyr Pro never tracks in the background. */
export async function ensurePermission(): Promise<void> {
  if (!(await Location.hasServicesEnabledAsync())) throw new LocationError('Turn on location services to check in.');
  const p = await Location.requestForegroundPermissionsAsync();
  if (!p.granted) throw new LocationError('Allow location for Klyr Pro in Settings. Showings are only recorded at the property.');
}

/** One fresh GPS reading for check-in or completion. Android also says whether a mock-location app produced it. */
export async function readLocation(): Promise<GeoReading> {
  await ensurePermission();
  const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, mayShowUserSettingsDialog: true });
  return {
    lat: l.coords.latitude, lng: l.coords.longitude, accuracyM: l.coords.accuracy ?? 9999,
    mocked: l.mocked ?? false, platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  };
}

/** Live position while a screen with a visit today is open, for "You're 320 m away". Display only; the API decides. */
export function useLivePosition(active: boolean) {
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracyM: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!active) return;
    let sub: Location.LocationSubscription | undefined;
    let stopped = false;
    (async () => {
      try {
        await ensurePermission();
        const s = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
          l => setPos({ lat: l.coords.latitude, lng: l.coords.longitude, accuracyM: l.coords.accuracy ?? 9999 }));
        if (stopped) s.remove(); else sub = s;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Location isn’t available.');
      }
    })();
    return () => { stopped = true; sub?.remove(); };
  }, [active]);
  return { pos, error };
}

/** Great-circle distance in metres. */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
