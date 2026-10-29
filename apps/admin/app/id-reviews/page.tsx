import { TORONTO } from '@klyr/core';
import { AdminNav } from '@/components/admin-nav';
import { requireOfficer } from '@/lib/session';
import { ReviewForm } from './review-form';

export const metadata = { title: 'ID reviews · Klyr Admin' };

const FUNDS: Record<string, string> = { savings: 'Savings', sale_of_property: 'Sale of a property', gift: 'Gift', investments: 'Investments', employment: 'Employment income', other: 'Other' };
const METHOD: Record<string, string> = { government_photo_id: 'Government photo ID', credit_file: 'Credit file', dual_process: 'Two sources' };
const when = (iso: string) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TORONTO });

export default async function IdReviewsPage() {
  const queue = await requireOfficer();
  return (
    <main className="a-wrap">
      <AdminNav current="id-reviews" />
      <h1 className="k-h1">ID reviews</h1>
      <p className="k-sub">
        Identity checks that need a person: a politically exposed person, a third party, or a company buyer. The buyer can’t book visits
        until you decide. Your decision and note are kept with the record for five years.
      </p>
      {!queue.length && <section className="k-card"><strong>Nothing waiting</strong><span className="k-note">New files appear here as buyers finish their ID check.</span></section>}
      {queue.map(r => (
        <article key={r.id} className="k-card" aria-label={`ID review for ${r.name ?? r.email}`}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 17 }}>{r.name ?? r.email}</strong>
            {r.politicallyExposed && <span className="a-flag">Politically exposed</span>}
            {r.actingForThirdParty && <span className="a-flag">Third party</span>}
            {r.buyingAs === 'company' && <span className="a-flag">Company</span>}
            <span className="k-note" style={{ marginLeft: 'auto' }}>Submitted {when(r.verifiedAt)}</span>
          </div>
          <div className="a-grid">
            <span><span className="k-note">Email</span><br />{r.email}</span>
            <span><span className="k-note">Occupation</span><br />{r.occupation}</span>
            <span><span className="k-note">Source of funds</span><br />{r.sourceOfFunds.map(f => FUNDS[f] ?? f).join(', ')}</span>
            <span><span className="k-note">ID method</span><br />{METHOD[r.method] ?? r.method} · {r.vendor}</span>
          </div>
          <ReviewForm id={r.id} name={r.name ?? r.email} />
        </article>
      ))}
    </main>
  );
}
