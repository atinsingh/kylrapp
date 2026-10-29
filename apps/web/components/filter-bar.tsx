'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
    </section>
  );
}
