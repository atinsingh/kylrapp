import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { Showing } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { CancelVisit } from './cancel-visit';

export const metadata = { title: 'Your visits · Klyr' };

const STATUS: Record<Showing['status'], [string, string, string]> = {
  requested: ['Waiting for the listing brokerage', '#FBEBDD', '#A54B00'],
  confirmed: ['Confirmed', '#E3F2E8', '#2B7A4B'],
  cancelled: ['Cancelled', '#F2F2F7', '#5E5E63'],
  completed: ['Visited', '#F2F2F7', '#5E5E63'],
};
const when = (iso: string) => new Date(iso).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' });

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ booked?: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const booked = (await searchParams).booked === '1';
  const [me, res] = await Promise.all([api<Me>('/auth/me'), api<Showing[]>('/showings')]);
  if (me.status === 401) redirect('/welcome');
  const visits = res.data ?? [];
  const upcoming = visits.filter(v => v.status !== 'cancelled' && Date.parse(v.at) > Date.now());
  const past = visits.filter(v => !upcoming.includes(v));
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="visits" />
      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 className="k-h1" style={{ fontSize: 28 }}>Your visits</h1>
        {booked && <div className="k-card" role="status" style={{ background: 'var(--tint)', color: 'var(--brand)', fontWeight: 600 }}>Visit requested. The listing brokerage confirms it, and we’ll let you know.</div>}
        <p className="k-note" style={{ margin: 0 }}>Visits are confirmed by the listing brokerage. Tenant-occupied homes need 24 hours’ written notice to the tenant.</p>
        {!visits.length && (
          <section className="k-card" style={{ alignItems: 'flex-start' }}>
            <strong>No visits yet</strong>
            <span className="k-note">Open any home and tap “Book a visit”.</span>
            <Link href="/" className="k-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', width: 'auto', padding: '0 24px' }}>Search homes</Link>
          </section>
        )}
        {[['UPCOMING', upcoming], ['PAST AND CANCELLED', past]].map(([label, list]) => (list as Showing[]).length > 0 && (
          <section key={label as string} className="k-card" aria-label={(label as string).toLowerCase()}>
            <div className="k-label">{label as string}</div>
            {(list as Showing[]).map((v, i) => {
              const [text, bg, fg] = STATUS[v.status];
              return (
                <div key={v.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '.5px solid var(--sep)' : 0, alignItems: 'center' }}>
                  {v.photo && <img src={v.photo.url} alt={v.photo.alt} style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 8, flex: 'none' }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/listings/${v.listingId}`} style={{ fontWeight: 700, color: 'var(--text)' }}>{v.address}, {v.city}</Link>
                    <div className="k-note">{when(v.at)}{v.note ? ` · “${v.note}”` : ''}</div>
                    <span style={{ display: 'inline-block', marginTop: 4, borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 600, background: bg, color: fg }}>{text}</span>
                  </div>
                  {upcoming.includes(v) && <CancelVisit id={v.id} address={v.address} />}
                </div>
              );
            })}
          </section>
        ))}
        <section className="k-card">
          <div className="k-label">AT THE VISIT</div>
          <p style={{ margin: 0, fontSize: 14 }}>Your agent opens the lockbox. Don’t take photos of the tenant’s belongings.</p>
        </section>
      </div>
    </main>
  );
}
