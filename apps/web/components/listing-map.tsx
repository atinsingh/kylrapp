'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import { money, moneyShort } from '@klyr/core';
import type { ListingCard } from '@klyr/api-client';

/**
 * Map of results with the all-in on each pin. Tiles come from NEXT_PUBLIC_MAP_TILES; the OpenStreetMap
 * default is for development only — production needs a commercial tile host (see docs/ARCHITECTURE.md).
 */
const TILES = process.env.NEXT_PUBLIC_MAP_TILES ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors';

export function ListingMap({ homes }: { homes: ListingCard[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ListingCard | null>(null);

  useEffect(() => {
    if (!el.current || !homes.length) return;
    let map: import('leaflet').Map | undefined;
    let cancelled = false;
    void import('leaflet').then(L => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      const bounds = L.latLngBounds(homes.map(h => [h.lat, h.lng]));
      for (const h of homes) {
        const abs = Math.abs(h.allIn), amount = abs < 10_000 ? money(abs) : moneyShort(abs);
        const label = h.allIn < 0 ? `${amount} back` : amount;
        const icon = L.divIcon({ className: 'k-pin', html: `<span>${label}</span>`, iconSize: [0, 0] });
        L.marker([h.lat, h.lng], { icon, keyboard: true, title: `${h.address}, all-in ${money(h.allIn)}`, alt: h.address })
          .on('click', () => setSelected(h)).addTo(map);
      }
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    });
    return () => { cancelled = true; map?.remove(); };
  }, [homes]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={el} role="region" aria-label="Map of homes. Each pin shows the all-in cost to close." style={{ height: 'min(70vh, 560px)', borderRadius: 16, overflow: 'hidden', background: 'var(--bg)' }} />
      {selected && (
        <div className="k-card" style={{ position: 'absolute', left: 56, right: 12, top: 12, maxWidth: 420, zIndex: 1000, flexDirection: 'row', gap: 12, boxShadow: '0 6px 20px rgba(0,0,0,.2)' }}>
          {selected.photos[0] && <img src={selected.photos[0].url} alt={selected.photos[0].alt} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 10, flex: 'none' }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'var(--brand)' }}>{selected.allIn < 0 ? 'You get back ' : 'All-in '}{money(Math.abs(selected.allIn))}</div>
            <Link href={`/listings/${selected.id}`} style={{ fontWeight: 700, color: 'var(--text)' }}>{selected.address}, {selected.city}</Link>
            <div className="k-note">{money(selected.price)} · {selected.beds} bed · {selected.type}</div>
            <div className="k-note">Listing brokerage: {selected.listingBrokerage}</div>
          </div>
          <button onClick={() => setSelected(null)} aria-label="Close preview" style={{ border: 0, background: 'none', fontSize: 20, minWidth: 44, minHeight: 44, alignSelf: 'flex-start' }}>×</button>
        </div>
      )}
    </div>
  );
}
