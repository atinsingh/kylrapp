import type { GeoReading } from '@klyr/api-client';

/**
 * One fresh, high-accuracy location reading for geofenced check-in. The browser can't tell
 * a mocked location from a real one; the phone app reports that, and the API measures the distance.
 */
export function readLocation(timeoutMs = 20_000): Promise<GeoReading> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser can’t share your location. Use the Klyr Pro phone app to check in.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      e => reject(new Error(
        e.code === e.PERMISSION_DENIED ? 'Allow location for Klyr Pro. Visits are only recorded at the property.'
          : e.code === e.TIMEOUT ? 'Finding your location took too long. Step outside and try again.'
            : 'Your location isn’t available right now. Turn on location services and try again.',
      )),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
  });
}
