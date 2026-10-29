'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Rental, Renting, TenantProfile } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { StepUp } from '@/components/step-up';
import { errorText, klyr } from '@/lib/client';

const n = (v: string) => Number(v.replace(/\D/g, '')) || 0;
export const STATUS = { submitted: 'With the landlord', accepted: 'Approved', declined: 'Not chosen', withdrawn: 'Withdrawn' } as const;
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Rent-control badge: the one thing tenants most often get wrong about Ontario rentals. */
export function RentControl({ r }: { r: Pick<Rental, 'rentControlled' | 'guideline'> }) {
  if (r.rentControlled == null) return null;
  return (
    <span style={{ display: 'inline-block', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 600, background: r.rentControlled ? '#E3F2E8' : '#FBEBDD', color: r.rentControlled ? '#2B7A4B' : '#A54B00' }}>
      {r.rentControlled ? `Rent-controlled · increases capped at ${r.guideline.pct}% in ${r.guideline.year}` : 'Not rent-controlled · first occupied after Nov 15, 2018'}
    </span>
  );
}

/** Form 346 ($0), then the profile that fills every application. */
export function TenantSetup({ renting: r, legalName }: { renting: Renting; legalName: string }) {
  const router = useRouter();
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [editing, setEditing] = useState(!r.profile);
  const [p, setP] = useState<TenantProfile>(r.profile ?? { monthlyIncome: 0, employer: '', jobTitle: '', occupants: 1, moveIn: '', references: [{ name: '', phone: '', relation: 'landlord' }], creditConsent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof TenantProfile>(k: K, v: TenantProfile[K]) => setP(x => ({ ...x, [k]: v }));
  const ref = (k: 'name' | 'phone', v: string) => setP(x => ({ ...x, references: [{ ...x.references[0]!, [k]: v }] }));

  async function sign() {
    setBusy(true); setError('');
    const res = await klyr.signTenantAgreement(name);
    setBusy(false);
    if (res.status === 403 && res.error?.code === 'step_up_required') return setStepUp(true);
    if (!res.ok) return setError(errorText(res.error));
    router.refresh();
  }
  async function save() {
    setBusy(true); setError('');
    const res = await klyr.saveTenantProfile({ ...p, pets: p.pets || undefined });
    setBusy(false);
    if (!res.ok) return setError(errorText(res.error));
    setEditing(false); router.refresh();
  }
  if (stepUp) return <StepUp reason="Signing your tenant agreement needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />;

  if (!r.agreement) return (
    <section className="k-card" aria-label="Tenant agreement" style={{ maxWidth: 640 }}>
      <div className="k-label">● RULE · BEFORE WE WORK FOR YOU · OREA FORM 346</div>
      <strong style={{ fontSize: 18 }}>Your tenant agreement · $0 to you</strong>
      {[['Term', '60 days.'], ['Cost to you', 'Nothing. Klyr is paid by the landlord, as offered on each rental.'], ['What Klyr does', 'Finds rentals, prepares your application and offer to lease, and explains the Ontario Standard Lease.']].map(([k, v]) => (
        <div key={k}><strong>{k}</strong><div className="k-note">{v}</div></div>
      ))}
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} /> I’ve read the summary. The standard OREA terms apply in full.</label>
      <label className="k-field">Type your full name to sign ({legalName})<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      {error && <div className="k-error" role="alert">{error}</div>}
      <button className="k-btn" disabled={busy || !read || name.trim().length < 2} onClick={sign}>Sign tenant agreement</button>
    </section>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
      {r.applications.length > 0 && (
        <section className="k-card" aria-label="Your applications">
          <div className="k-label">YOUR APPLICATIONS</div>
          {r.applications.map((a, i) => (
            <div key={a.id} style={{ padding: '8px 0', borderTop: i ? '.5px solid var(--sep)' : 0 }}>
              <Link href={`/rent/${a.listingId}`} style={{ fontWeight: 700, color: 'var(--text)' }}>{a.address}, {a.city}</Link>
              <div className="k-note">{money(a.rent)}/month from {longDate(a.startDate)} · {STATUS[a.status]}{a.status === 'accepted' ? ` · next: sign the Ontario Standard Lease and pay ${money(a.moveIn.total)} (first and last month)` : ''}</div>
            </div>
          ))}
        </section>
      )}
      <section className="k-card" aria-label="Rental profile">
        <div className="k-label">YOUR RENTAL PROFILE · FILLS EVERY APPLICATION (FORM 410)</div>
        {!editing && r.profile ? (
          <>
            <div className="k-note">{money(r.profile.monthlyIncome)}/month · {r.profile.jobTitle}, {r.profile.employer} · {r.profile.occupants} occupant(s) · move-in {longDate(r.profile.moveIn)} · {r.profile.references.length} reference(s) · credit check {r.profile.creditConsent ? 'allowed' : 'not allowed'}</div>
            <button className="k-btn k-alt" style={{ width: 'auto', padding: '0 16px', alignSelf: 'flex-start' }} onClick={() => setEditing(true)}>Edit profile</button>
          </>
        ) : (
          <>
            <span className="k-note">Landlords may ask about income, work, references and, with your consent, credit. They can’t choose on family status, age, public assistance or other Human Rights Code grounds, so we don’t ask.</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Monthly income before tax<input inputMode="numeric" value={p.monthlyIncome ? p.monthlyIncome.toLocaleString('en-CA') : ''} onChange={e => set('monthlyIncome', n(e.target.value))} /></label>
              <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Occupants (including you)<input inputMode="numeric" value={p.occupants} onChange={e => set('occupants', n(e.target.value) || 1)} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Employer<input value={p.employer} onChange={e => set('employer', e.target.value)} /></label>
              <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Job title<input value={p.jobTitle} onChange={e => set('jobTitle', e.target.value)} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Move-in date<input type="date" value={p.moveIn} onChange={e => set('moveIn', e.target.value)} /></label>
              <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Pets (optional)<input value={p.pets ?? ''} onChange={e => set('pets', e.target.value)} placeholder="e.g. one cat" /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Reference: name<input value={p.references[0]!.name} onChange={e => ref('name', e.target.value)} /></label>
              <label className="k-field" style={{ flex: 1, minWidth: 160 }}>Reference: phone<input value={p.references[0]!.phone} onChange={e => ref('phone', e.target.value)} /></label>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={p.creditConsent} onChange={e => set('creditConsent', e.target.checked)} /> Landlords I apply to may run a credit check.</label>
            <span className="k-note">In Ontario a “no pets” clause in a lease is void, but a condo’s own rules can still restrict pets.</span>
            {error && <div className="k-error" role="alert">{error}</div>}
            <button className="k-btn" disabled={busy || !p.monthlyIncome || !p.employer.trim() || !p.jobTitle.trim() || !p.moveIn || !p.references[0]!.name.trim() || !p.references[0]!.phone.trim()} onClick={save}>Save profile</button>
          </>
        )}
      </section>
      {r.agent && <span className="k-note">Your agent: {r.agent.name}, {r.agent.title}. Tenant agreement signed {torontoWhen(r.agreement.signedAt)}.</span>}
    </div>
  );
}

export function RentalCards({ rentals, applied }: { rentals: Rental[]; applied: Map<string, string> }) {
  return (
    <section aria-label="Rentals" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {rentals.length === 0 && <div className="k-card"><strong>No rentals match</strong><span className="k-note">New rentals appear here as landlords list with Klyr.</span></div>}
      {rentals.map(r => (
        <Link key={r.id} href={`/rent/${r.id}`} className="k-card" style={{ color: 'var(--text)', textDecoration: 'none', padding: 0, overflow: 'hidden' }} aria-label={`${r.address}, ${r.city}, ${money(r.rent)} a month`}>
          {r.photo && <img src={r.photo.url} alt={r.photo.alt} style={{ width: '100%', height: 160, objectFit: 'cover' }} />}
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong style={{ fontSize: 20 }}>{money(r.rent)}<span className="k-note"> /month</span></strong>
            <span>{r.address}, {r.city}</span>
            <span className="k-note">{r.beds} bd · {r.baths} ba · {r.type}{r.availableFrom ? ` · available ${longDate(r.availableFrom)}` : ''}</span>
            <span className="k-note">Move-in {money(r.moveIn.total)}: first and last month</span>
            <RentControl r={r} />
            {applied.has(r.id) && <span className="k-note" style={{ fontWeight: 700, color: 'var(--brand)' }}>You applied · {STATUS[applied.get(r.id) as keyof typeof STATUS]}</span>}
            <span className="k-note">Listing brokerage: {r.listingBrokerage}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
