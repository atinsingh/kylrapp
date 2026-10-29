import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import 'leaflet/dist/leaflet.css';
import type { ListingCard } from '@klyr/api-client';
import { money, moneyShort } from '@klyr/core';
import { color } from '@klyr/tokens';

/** The phone app's web preview: Leaflet instead of native maps. Tiles from EXPO_PUBLIC_MAP_TILES (OSM in development only). */
const TILES = process.env.EXPO_PUBLIC_MAP_TILES ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function pinLabel(h: ListingCard) {
  const abs = Math.abs(h.allIn), amount = abs < 10_000 ? money(abs) : moneyShort(abs);
  return h.allIn < 0 ? `${amount} back` : amount;
}

export function HomesMap({ homes, onOpen }: { homes: ListingCard[]; onOpen: (id: string) => void }) {
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = el.current;
    if (!node || !homes.length) return;
    let map: import('leaflet').Map | undefined, cancelled = false;
    void import('leaflet').then(L => {
      if (cancelled) return;
      map = L.map(node, { scrollWheelZoom: false });
      L.tileLayer(TILES, { attribution: process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      for (const h of homes) {
        const icon = L.divIcon({ className: 'k-pin', iconSize: [0, 0],
          html: `<span style="display:inline-block;transform:translate(-50%,-100%);white-space:nowrap;border-radius:999px;padding:5px 10px;color:#fff;background:${color.brand};font:800 12px Sora_800ExtraBold,system-ui;box-shadow:0 4px 10px rgba(0,0,0,.25);cursor:pointer">${pinLabel(h)}</span>` });
        L.marker([h.lat, h.lng], { icon, keyboard: true, title: `${h.address}, all-in ${money(h.allIn)}`, alt: h.address }).on('click', () => onOpen(h.id)).addTo(map);
      }
      map.fitBounds(L.latLngBounds(homes.map(h => [h.lat, h.lng])), { padding: [40, 40], maxZoom: 14 });
    });
    return () => { cancelled = true; map?.remove(); };
  }, [homes, onOpen]);
  return <View ref={el as never} accessibilityLabel="Map of homes. Each pin shows the all-in cost to close." style={{ height: 460, borderRadius: 16, overflow: 'hidden' }} />;
}
