import { redirect } from 'next/navigation';
import type { Me } from '@klyr/contracts';
import type { Rental, Renting } from '@klyr/api-client';
import { AppHeader } from '@/components/app-header';
import { api, sessionToken } from '@/lib/session';
import { RentalCards, TenantSetup } from './tenant';

export const metadata = { title: 'Rent a home · Klyr' };

/** Renting: Form 346 at no cost, one profile for every application, rentals with move-in cost and rent control. */
export default async function RentPage({ searchParams }: { searchParams: Promise<{ city?: string; maxRent?: string }> }) {
  if (!(await sessionToken())) redirect('/welcome');
  const q = await searchParams;
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
  const [me, r, rentals] = await Promise.all([api<Me>('/auth/me'), api<Renting>('/renting'), api<Rental[]>(`/rentals${qs ? '?' + qs : ''}`)]);
  if (me.status === 401) redirect('/welcome');
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <AppHeader me={me.data} current="rent" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 className="k-h1" style={{ fontSize: 26 }}>Rent a home</h1>
          <p className="k-sub" style={{ marginTop: 6 }}>No fee to you. Every rental shows the move-in cost and whether rent increases are capped.</p>
        </div>
        <TenantSetup renting={r.data!} legalName={me.data?.legalName ?? ''} />
        <RentalCards rentals={rentals.data ?? []} applied={new Map((r.data?.applications ?? []).map(a => [a.listingId, a.status]))} />
      </div>
    </main>
  );
}
