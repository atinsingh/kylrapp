'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SavedSearch, SearchFilters } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';

const CITIES = ['Mississauga', 'Toronto', 'Oakville', 'Brampton', 'Burlington'];
const MAX = [900_000, 1_100_000, 1_300_000, 1_600_000];
const short = (n: number) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n / 1000 + 'K');

/** Filters live in the URL, so a search can be shared, bookmarked and saved later. */
export function FilterBar() {
  const router = useRouter(), path = usePathname(), params = useSearchParams();
  const cities = (params.get('city') ?? '').split(',').filter(Boolean);
  const set = (key: string, value: string | null) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value); else p.delete(key);
    router.replace(`${path}${p.size ? '?' + p : ''}`, { scroll: false });
  };
  const toggleCity = (c: string) => {
    const next = cities.includes(c) ? cities.filter(x => x !== c) : [...cities, c];
    set('city', next.join(',') || null);
  };
  const row = { display: 'flex', flexWrap: 'wrap' as const, gap: 6, alignItems: 'center' };
  return (
    <section aria-label="Filters" className="k-card" style={{ marginBottom: 16, gap: 10 }}>
      <div style={row}>
        <span className="k-label" style={{ width: 64 }}>WHERE</span>
        {CITIES.map(c => <button key={c} className="k-chip" aria-pressed={cities.includes(c)} onClick={() => toggleCity(c)}>{c}</button>)}
      </div>
      <div style={row}>
        <span className="k-label" style={{ width: 64 }}>PRICE</span>
        {MAX.map(v => <button key={v} className="k-chip" aria-pressed={params.get('maxPrice') === String(v)} onClick={() => set('maxPrice', params.get('maxPrice') === String(v) ? null : String(v))}>Up to {short(v)}</button>)}
      </div>
      <div style={row}>
        <span className="k-label" style={{ width: 64 }}>BEDS</span>
        {[2, 3, 4].map(b => <button key={b} className="k-chip" aria-pressed={params.get('minBeds') === String(b)} onClick={() => set('minBeds', params.get('minBeds') === String(b) ? null : String(b))}>{b}+</button>)}
        <span className="k-label" style={{ marginLeft: 12 }}>TYPE</span>
        {['House', 'Townhouse', 'Condo'].map(t => <button key={t} className="k-chip" aria-pressed={params.get('type') === t} onClick={() => set('type', params.get('type') === t ? null : t)}>{t}</button>)}
      </div>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <label className="k-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>SORT
          <select value={params.get('sort') ?? 'price_asc'} onChange={e => set('sort', e.target.value === 'price_asc' ? null : e.target.value)}
            style={{ font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--text)', border: 0, borderRadius: 10, padding: '8px 10px', boxShadow: '0 0 0 .5px var(--sep)', background: '#fff' }}>
            <option value="price_asc">Price, low to high</option>
            <option value="price_desc">Price, high to low</option>
            <option value="newest">Newest</option>
          </select>
        </label>
        {params.size > 0 && <button onClick={() => router.replace(path, { scroll: false })} style={{ border: 0, background: 'none', color: 'var(--brand)', fontWeight: 700, fontSize: 13, minHeight: 44 }}>Clear filters</button>}
      </div>
      <SaveSearch params={params} />
    </section>
  );
}

/** "Oakville, Mississauga · up to $1.2M · 3+ beds · Condo" from the URL's filters. */
export function describeFilters(f: SearchFilters) {
  return [f.city?.split(',').join(', ') || 'All areas', f.maxPrice && `up to ${short(f.maxPrice)}`, f.minBeds && `${f.minBeds}+ beds`, f.type].filter(Boolean).join(' · ');
}

function SaveSearch({ params }: { params: URLSearchParams }) {
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState<SavedSearch['alert']>('daily');
  const [state, setState] = useState<'idle' | 'busy' | 'saved'>('idle');
  const [error, setError] = useState('');
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  const filters: SearchFilters = { city: params.get('city') || undefined, maxPrice: num('maxPrice'), minBeds: num('minBeds'), type: (params.get('type') as SearchFilters['type']) || undefined };
  const name = describeFilters(filters);
  async function save() {
    setState('busy'); setError('');
    const r = await klyr.saveSearch(name, filters, alert);
    if (!r.ok) { setState('idle'); return setError(errorText(r.error)); }
    setState('saved');
  }
  if (state === 'saved') return <div className="k-note" role="status" style={{ color: 'var(--brand)', fontWeight: 700 }}>Saved “{name}”. {alert === 'off' ? 'No alerts.' : alert === 'instant' ? 'We’ll tell you within minutes of a new listing or price drop.' : 'A morning email when something changes.'} Manage it under Saved.</div>;
  if (!open) return <button className="k-btn k-alt" style={{ width: 'auto', alignSelf: 'flex-start', padding: '0 16px', minHeight: 44 }} onClick={() => setOpen(true)}>Save this search</button>;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
      <select className="k-select" aria-label="Alerts" value={alert} onChange={e => setAlert(e.target.value as SavedSearch['alert'])}>
        <option value="instant">Alert me right away</option>
        <option value="daily">Daily email</option>
        <option value="off">No alerts</option>
      </select>
      <button className="k-btn" style={{ width: 'auto', padding: '0 16px', minHeight: 44 }} disabled={state === 'busy'} onClick={save}>Save search</button>
      {error && <span className="k-error" role="alert">{error}</span>}
    </div>
  );
}
