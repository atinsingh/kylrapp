import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { listings } from '../db/schema.js';
import { startApp } from '../test/harness.js';
import { AGENT_EMAIL, people, resetStaff } from '../test/people.js';

let h: Awaited<ReturnType<typeof startApp>>;
let p: ReturnType<typeof people>;
const { db, pool } = createDb();
const cleanup: (() => Promise<unknown>)[] = [];
beforeAll(async () => { h = await startApp(); p = people(h); await import('../db/seed.js'); await resetStaff(db); });
afterAll(async () => { for (const c of cleanup) await c(); await h?.app.close(); await pool.end(); });

const mail = (to: string) => h.outbox.filter(m => m.to === to).at(-1)!;
const sign = { typedName: 'Test Buyer', readConfirmed: true };
const home = {
  address: '9 Willow St', unit: '2', city: 'Toronto', type: 'Condo', beds: 2, baths: 1, sqft: 820, firstOccupied: '2021-05-01',
  parking: '1 underground', utilities: 'Hydro extra', furnished: false, description: 'Bright two-bedroom by the subway.', rent: 3100, availableFrom: '2026-12-01',
};
const profile = (income: number) => ({
  monthlyIncome: income, employer: 'Lakeshore Hospital', jobTitle: 'Nurse', occupants: 2, moveIn: '2026-12-01',
  references: [{ name: 'Sam Okoye', phone: '416-555-0101', relation: 'landlord' }], creditConsent: true,
});

async function signedIn() {
  const t = await h.signedIn();
  const email = (await h.call('GET', '/auth/me', undefined, t)).body.email as string;
  await p.stepUp(t, email);
  return { t, email };
}

describe('renting and leasing out', () => {
  it('lists a rental, takes two applications on the same terms, and the landlord chooses one', async () => {
    // Landlord: first-year rent after fees, the tenant-side fee is their choice, Form 210, published by the agent.
    const ll = await signedIn();
    expect((await h.call('GET', '/leasing', undefined, ll.t)).body.code).toBe('not_leasing');
    const started = (await h.call('POST', '/leasing', home, ll.t)).body;
    expect(started).toMatchObject({ stage: 'preparing', rent: 3100, tenantSidePct: 0.5, rentControlled: false, net: { gross: 37_200, fee: 790, tenantSide: 1752 } });
    expect((await h.call('PUT', '/leasing/plan', { rent: 3000, tenantSidePct: 1, availableFrom: '2026-12-01' }, ll.t)).body.net).toMatchObject({ gross: 36_000, tenantSide: 3390 });
    await h.call('PUT', '/leasing/plan', { rent: 3100, tenantSidePct: 0.5, availableFrom: '2026-12-01' }, ll.t);
    const signed = (await h.call('POST', '/leasing/agreement/sign', sign, ll.t)).body;
    const doc = (await h.call('GET', `/documents/${signed.agreement.documentId}`, undefined, ll.t)).body;
    expect(doc.record).toMatchObject({ form: '210', title: 'Listing Agreement – Lease' });
    expect(doc.record.clauses.find((c: [string, string]) => c[0] === 'Fair screening')[1]).toMatch(/Human Rights Code/);
    const agent = await p.staff(AGENT_EMAIL[signed.agent.name]!);
    const { listingId } = (await h.call('POST', `/pro/rentals/${started.dealId}/publish`, { lat: 43.66, lng: -79.39, photos: ['https://media.example/willow/1.jpg'] }, agent)).body;
    cleanup.push(() => db.update(listings).set({ status: 'terminated' }).where(eq(listings.id, listingId)));
    expect(mail(ll.email).subject).toBe('Your rental is live · 9 Willow St');

    // Rentals show the move-in cost and rent-control status, and never appear in the for-sale search.
    const found = (await h.call('GET', '/rentals?city=Toronto', undefined, ll.t)).body.find((r: { id: string }) => r.id === listingId);
    expect(found).toMatchObject({ address: '9 Willow St #2', rent: 3100, moveIn: { total: 6200 }, rentControlled: false, availableFrom: '2026-12-01' });
    expect((await h.call('GET', '/listings?city=Toronto', undefined, ll.t)).body.results.some((l: { id: string }) => l.id === listingId)).toBe(false);

    // Tenant A: Form 346 ($0), profile, Form 326 with the landlord, then Form 410 + 400.
    const a = await signedIn();
    expect((await h.call('POST', `/rentals/${listingId}/apply`, { rent: 3100, startDate: '2026-12-01', termMonths: 12, ...sign }, a.t)).body.code).toBe('agreement_required');
    expect((await h.call('POST', '/renting/agreement/sign', sign, a.t)).body.agreement).not.toBeNull();
    const apply = (t: string, rent = 3100) => h.call('POST', `/rentals/${listingId}/apply`, { rent, startDate: '2026-12-01', termMonths: 12, ...sign }, t);
    expect((await apply(a.t)).body.code).toBe('profile_required');
    await h.call('PUT', '/renting/profile', profile(9800), a.t);
    expect((await apply(a.t)).body.code).toBe('multiple_representation');
    await h.call('POST', `/rentals/${listingId}/consent`, sign, a.t);
    expect(mail(ll.email).subject).toBe('A Klyr tenant wants to apply · 9 Willow St');
    const consentA = (await h.call('GET', '/leasing', undefined, ll.t)).body.consents[0];
    await h.call('POST', `/leasing/consents/${consentA.id}/sign`, sign, ll.t);
    expect(mail(a.email).subject).toBe('You can apply · 9 Willow St');
    const appliedA = (await apply(a.t)).body;
    expect(appliedA.application).toMatchObject({ status: 'submitted', rent: 3100, moveIn: { total: 6200 } });
    expect((await apply(a.t)).body.code).toBe('already_applied');
    expect(mail(ll.email).subject).toBe('New application · 9 Willow St #2');

    // Tenant B applies too.
    const b = await signedIn();
    await h.call('POST', '/renting/agreement/sign', sign, b.t);
    await h.call('PUT', '/renting/profile', profile(7000), b.t);
    await h.call('POST', `/rentals/${listingId}/consent`, sign, b.t);
    const consentB = (await h.call('GET', '/leasing', undefined, ll.t)).body.consents[1];
    await h.call('POST', `/leasing/consents/${consentB.id}/sign`, sign, ll.t);
    await apply(b.t, 3050);

    // The landlord sees both on the same terms, and nothing on protected grounds.
    const view = (await h.call('GET', '/leasing', undefined, ll.t)).body;
    expect(view.applications.map((x: { screening: { incomeToRent: number } }) => x.screening.incomeToRent)).toEqual([3.2, 2.3]);
    expect(Object.keys(view.applications[0].screening).sort()).toEqual(['creditConsent', 'employer', 'incomeToRent', 'jobTitle', 'monthlyIncome', 'occupants', 'pets', 'references']);

    // Accepting tenant A declines tenant B, leases the listing and moves both deals to firm.
    const done = (await h.call('POST', `/leasing/applications/${view.applications[0].id}`, { result: 'accepted', ...sign }, ll.t)).body;
    expect(done.applications.map((x: { status: string }) => x.status)).toEqual(['accepted', 'declined']);
    expect(done.stage).toBe('firm');
    expect(mail(a.email).subject).toBe('Approved · 9 Willow St');
    expect(mail(a.email).text).toMatch(/Ontario Standard Lease \(2229E\).*\$6,200/s);
    expect(mail(b.email).subject).toBe('Update on your application · 9 Willow St');
    expect((await h.call('GET', '/renting', undefined, a.t)).body.applications[0].status).toBe('accepted');
    expect((await h.call('GET', '/rentals?city=Toronto', undefined, a.t)).body.some((r: { id: string }) => r.id === listingId)).toBe(false);
  });
});
