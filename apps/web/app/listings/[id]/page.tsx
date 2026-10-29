import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { money } from '@klyr/core';
import type { Me } from '@klyr/contracts';
import type { ListingDetail } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { PhotoStrip } from '@/components/photo-strip';
import { SaveButton } from '@/components/save-button';
import { CompareToggle } from '@/components/compare-controls';
import { BROKERAGE_LINE, LISTING_DATA_LINE } from '@/lib/brand';
import { api, sessionToken } from '@/lib/session';

const EVENTS: Record<ListingDetail['history'][number]['event'], string> = {
  listed: 'Listed', price_change: 'Price change', sold: 'Sold', leased: 'Leased', terminated: 'Taken off the market', expired: 'Listing expired',
};
const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
const month = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const { id } = await params;
  const [me, res] = await Promise.all([api<Me>('/auth/me'), api<ListingDetail>(`/listings/${encodeURIComponent(id)}`)]);
  if (me.status === 401) redirect('/welcome');
  if (res.status === 404 || res.status === 400) notFound();
  const l = res.data;
  if (!l) return <main className="k-page"><p role="alert">Can’t load this home right now. Try again in a moment.</p></main>;
  const e = l.estimate, condo = l.type === 'Condo';

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 96px' }}>
      <AppHeader me={me.data} />
      <Link href="/" style={{ fontSize: 13, fontWeight: 700 }}>‹ Back to search</Link>

      <div style={{ borderRadius: 16, overflow: 'hidden', margin: '12px 0 16px' }}>
        <PhotoStrip photos={l.photos} address={l.address} sample={l.samplePhotos} tall />
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="k-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>{money(l.price)}</span>
              {l.daysOnMarket != null && <span className="k-note">{l.daysOnMarket} days on market</span>}
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{l.address}, {l.city}</h1>
            <div style={{ color: 'var(--muted)' }}>{l.beds} bed · {l.baths} bath{l.sqft ? ` · ${l.sqft.toLocaleString('en-CA')} sq ft` : ''} · {l.style ?? l.type} · {l.neighbourhood}</div>
            <div className="k-note">Listing brokerage: {l.listingBrokerage}</div>
          </section>

          <section className="k-card" aria-labelledby="allin">
            <div id="allin" className="k-label">{e.allIn < 0 ? 'YOU GET BACK AT CLOSING' : 'ALL-IN COST TO CLOSE'} · AT ASKING</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--brand)', letterSpacing: '-.02em' }}>{money(Math.abs(e.allIn))}</div>
            <div className="k-note">after {money(e.cashBack)} cash back · {pct(l.coop)} offered to the buyer’s brokerage</div>
            <div className="k-note">Estimate as of {day(e.asOf)} · <Link href="/estimate">How we estimate</Link>{e.customAssumptions ? ' · using your inputs' : ''}</div>
            <Rows rows={[
              ['Ontario land transfer tax', money(e.ltt.on)],
              ...(e.ltt.onR ? [['First-time buyer refund', '−' + money(e.ltt.onR)] as [string, string]] : []),
              ...(e.ltt.to ? [['Toronto land transfer tax', money(e.ltt.to)] as [string, string]] : []),
              ...(e.ltt.toR ? [['Toronto first-time refund', '−' + money(e.ltt.toR)] as [string, string]] : []),
              ['Lawyer · fee + HST + disbursements', money(e.lawyer)],
              ...(condo ? [['Status certificate', money(e.statusCertificate)] as [string, string]] : [['Inspection', money(e.inspection)] as [string, string]]),
              ['Title insurance', money(e.title)],
              ['Adjustments, estimated', money(e.adjustments)],
              ['Klyr cash back', '−' + money(e.cashBack)],
            ]} total={[e.allIn < 0 ? 'You get back' : 'All-in', money(Math.abs(e.allIn))]} />
          </section>

          <Section title="MONTHLY AND DOWN PAYMENT">
            <Rows rows={[
              [`Down payment · ${+(e.downPct * 100).toFixed(1)}%`, money(e.down)],
              ...(e.cmhc ? [['CMHC insurance, added to the mortgage', money(e.cmhc)] as [string, string]] : []),
              [`Mortgage · ${pct(e.rate)}, 25 yr`, money(e.monthly) + '/mo'],
              ['Property tax', money(e.monthlyTax) + '/mo'],
              ...(l.condoFee ? [['Condo fee', money(l.condoFee) + '/mo'] as [string, string]] : []),
            ]} />
            {e.downRaised && <p className="k-note" style={{ margin: 0, color: '#A54B00' }}>Your usual down payment is below the minimum for this price, so this uses the minimum, {money(e.down)}.</p>}
          </Section>

          {(l.openHouse || l.offerDate) && (
            <Section title="OPEN HOUSE AND OFFERS">
              <Rows rows={[['Open house', l.openHouse ?? '—'], ['Offers', l.offerDate ?? '—']]} />
            </Section>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {l.history.length > 0 && (
            <Section title="PRICE HISTORY">
              <Rows rows={l.history.map(h => [`${EVENTS[h.event]} · ${day(h.at)}`, h.price != null ? money(h.price) : '—'])} />
            </Section>
          )}

          <Section title="SOLD NEARBY · LAST 6 MONTHS">
            {l.comparables.length ? (
              <Rows rows={l.comparables.map(c => [
                <span key={c.address}><strong style={{ fontWeight: 600 }}>{c.address}</strong><br /><span className="k-note">{c.beds} bed{c.sqft ? ` · ${c.sqft.toLocaleString('en-CA')} sq ft` : ''} · {month(c.soldAt)} · {(c.distanceM / 1000).toFixed(1)} km</span></span>,
                money(c.soldPrice),
              ])} />
            ) : <p className="k-note" style={{ margin: 0 }}>No sales of similar homes within 2 km in the last 6 months.</p>}
            <p className="k-note" style={{ margin: 0 }}>Sold prices from the board, shown to registered users under MLS® VOW rules.</p>
          </Section>

          {l.insights && (
            <>
              <Section title={`NEIGHBOURHOOD AND SCHOOLS · ${l.neighbourhood?.toUpperCase() ?? ''}`}>
                <Rows rows={l.insights.schools.map(s => [<span key={s.name}>{s.name}<br /><span className="k-note">{s.grades}</span></span>, s.distance])} />
                {l.insights.nearby && <p className="k-note" style={{ margin: 0 }}>{l.insights.nearby}. Check school boundaries with the board before you offer.</p>}
              </Section>
              <Section title="COMMUTE">
                <Rows rows={l.insights.commute.map(c => [<span key={c.how}>{c.to}<br /><span className="k-note">{c.how}</span></span>, c.time])} />
              </Section>
            </>
          )}

          <Section title="DETAILS">
            <Rows rows={[
              ['Type', [l.style, l.type].filter(Boolean).join(' · ')],
              ...(l.yearBuilt ? [['Built', String(l.yearBuilt)] as [string, string]] : []),
              ...(l.lot ? [['Lot', l.lot] as [string, string]] : []),
              ...(l.parking ? [['Parking', l.parking] as [string, string]] : []),
              ...(l.heating ? [['Heating', l.heating] as [string, string]] : []),
              ...(l.annualTax ? [['Taxes', money(l.annualTax) + '/yr'] as [string, string]] : []),
              ['Buyer brokerage', pct(l.coop)],
              ['MLS® number', l.mlsNumber],
            ]} />
          </Section>
        </div>
      </div>

      <footer style={{ fontSize: 12, color: 'var(--muted)', marginTop: 24 }}>{BROKERAGE_LINE} · Listing brokerage: {l.listingBrokerage} · {LISTING_DATA_LINE}</footer>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(242,242,247,.92)', backdropFilter: 'blur(10px)', borderTop: '.5px solid var(--sep)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="k-note">{e.allIn < 0 ? 'You get back' : 'All-in to close'}</div>
            <div style={{ fontWeight: 800, color: 'var(--brand)', fontSize: 18 }}>{money(Math.abs(e.allIn))}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CompareToggle id={l.id} address={l.address} />
            <SaveButton id={l.id} saved={l.saved} address={l.address} large />
            <Link href={`/visit/${l.id}`} className="k-btn k-alt" style={{ width: 'auto', display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Book a visit</Link>
            <Link href={`/offer/${l.id}`} className="k-btn" style={{ width: 'auto', display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Make an offer</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="k-card" aria-label={title.toLowerCase()}><div className="k-label">{title}</div>{children}</section>;
}

function Rows({ rows, total }: { rows: [ReactNode, string][]; total?: [string, string] }) {
  return (
    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
          <dt style={{ fontSize: 14 }}>{k}</dt><dd style={{ margin: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>{v}</dd>
        </div>
      ))}
      {total && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid var(--text)', fontWeight: 800 }}>
          <dt>{total[0]}</dt><dd style={{ margin: 0, color: 'var(--brand)' }}>{total[1]}</dd>
        </div>
      )}
    </dl>
  );
}
