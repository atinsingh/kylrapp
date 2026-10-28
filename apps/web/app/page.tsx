import { money } from '@klyr/core';

/** Placeholder until the real brokerage details are confirmed (Launch Checklist action 2). */
const BROKERAGE_FOOTER = 'Klyr Realty Inc., Brokerage · RECO registration pending · Listing data © PropTx, used under VOW terms';

type Card = {
  id: string; address: string; city: string; type: string; beds: number | null; baths: number | null;
  price: number; allIn: number; cashBack: number; monthly: number; listingBrokerage: string;
};

async function search(): Promise<{ results: Card[]; capped: boolean } | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/listings`, { cache: 'no-store' });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

/** Buyer search: the all-in cost to close is the hero number on every card. */
export default async function SearchPage() {
  const data = await search();
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px' }}>Search</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 20px' }}>All-in cost to close after your cash back. Estimate as of Oct 27, 2026.</p>
      {!data && <p role="alert">Can’t reach the Klyr API. Start it with <code>pnpm --filter @klyr/api dev</code>.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {data?.results.map(l => (
          <li key={l.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 0 0 .5px var(--sep)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em' }}>ALL-IN TO CLOSE</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand)' }}>{money(l.allIn)}</div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>{l.address}, {l.city}</div>
            <div style={{ color: 'var(--muted)' }}>{money(l.price)} · {l.beds} bed · {l.baths} bath · {l.type}</div>
            <div style={{ color: 'var(--muted)' }}>{money(l.cashBack)} cash back · {money(l.monthly)}/mo</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Listing brokerage: {l.listingBrokerage}</div>
          </li>
        ))}
      </ul>
      {data?.capped && <p>Showing the first 100 homes. Refine your search to see more.</p>}
      <footer style={{ fontSize: 12, color: 'var(--muted)', marginTop: 32 }}>{BROKERAGE_FOOTER}</footer>
    </main>
  );
}
