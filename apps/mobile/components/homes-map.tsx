import { Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { ListingCard } from '@klyr/api-client';
import { money, moneyShort } from '@klyr/core';
import { color } from '@klyr/tokens';
import { sora } from './ui';

/** The all-in on each pin, as on web. Apple Maps on iOS; Google Maps on Android (needs its API key in app.json). */
export function pinLabel(h: ListingCard) {
  const abs = Math.abs(h.allIn), amount = abs < 10_000 ? money(abs) : moneyShort(abs);
  return h.allIn < 0 ? `${amount} back` : amount;
}

export function HomesMap({ homes, onOpen }: { homes: ListingCard[]; onOpen: (id: string) => void }) {
  if (!homes.length) return null;
  const lats = homes.map(h => h.lat), lngs = homes.map(h => h.lng);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.02, (Math.max(...lats) - Math.min(...lats)) * 1.4), longitudeDelta: Math.max(0.02, (Math.max(...lngs) - Math.min(...lngs)) * 1.4),
  };
  return (
    <View style={{ height: 460, borderRadius: 16, overflow: 'hidden' }} accessibilityLabel="Map of homes. Each pin shows the all-in cost to close.">
      <MapView style={{ flex: 1 }} initialRegion={region}>
        {homes.map(h => (
          <Marker key={h.id} coordinate={{ latitude: h.lat, longitude: h.lng }} onPress={() => onOpen(h.id)} accessibilityLabel={`${h.address}, all-in ${money(h.allIn)}`}>
            <Pressable style={{ backgroundColor: color.brand, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ ...sora(800), fontSize: 12, color: '#fff' }}>{pinLabel(h)}</Text>
            </Pressable>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
