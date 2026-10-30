import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { RentalDetail, Renting } from '@klyr/api-client';
import { money } from '@klyr/core';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { RentControl } from '../tenant';
import { Apply } from './apply';
import { Viewings } from './viewings';

export const metadata = { title: 'Rental · Klyr' };
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default async function RentalPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const { id } = await params;
  const [me, rr, renting] = await Promise.all([api<Me>('/auth/me'), api<RentalDetail>(`/rentals/${encodeURIComponent(id)}`), api<Renting>('/renting')]);
  if (me.status === 401) redirect('/welcome');
  if (!rr.data) notFound();
  const r = rr.data;
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="rent" />
      <Link href="/rent" style={{ fontSize: 13, fontWeight: 700 }}>‹ All rentals</Link>
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {r.photos[0] && <img src={r.photos[0].url} alt={r.photos[0].alt} style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 16 }} />}
        <div>
          <h1 className="k-h1" style={{ fontSize: 26 }}>{money(r.rent)}<span className="k-note" style={{ fontSize: 16 }}> /month</span></h1>
          <p className="k-sub" style={{ marginTop: 6 }}>{r.address}, {r.city} · {r.beds} bd · {r.baths} ba{r.sqft ? ` · ${r.sqft} sq ft` : ''} · {r.type}</p>
        </div>
        <section className="k-card" aria-label="Move-in cost">
          <div className="k-label">TO MOVE IN</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>First month</span><strong>{money(r.moveIn.firstMonth)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Last month’s rent deposit</span><strong>{money(r.moveIn.lastMonth)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--text)', paddingTop: 6 }}><strong>Total</strong><strong>{money(r.moveIn.total)}</strong></div>
          <span className="k-note">In Ontario, last month’s rent is the only deposit a landlord can take. It earns interest each year. A refundable key deposit is the only other charge allowed.</span>
          <RentControl r={r} />
        </section>
        <section className="k-card">
          {r.description && <p style={{ margin: 0 }}>{r.description}</p>}
          <div className="k-note">{[r.availableFrom && `Available ${longDate(r.availableFrom)}`, r.parking && `Parking: ${r.parking}`, r.utilities && `Utilities: ${r.utilities}`, r.furnished ? 'Furnished' : 'Unfurnished'].filter(Boolean).join(' · ')}</div>
          <div className="k-note">Listing brokerage: {r.listingBrokerage}</div>
        </section>
        {r.status === 'active' && <Viewings listingId={r.id} viewings={r.viewings} canBook={!!renting.data?.agreement} />}
        <Apply rental={r} renting={renting.data!} legalName={me.data?.legalName ?? ''} />
      </div>
    </main>
  );
}
