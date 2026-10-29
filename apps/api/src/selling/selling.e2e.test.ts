import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { listings } from '../db/schema.js';
import { startApp } from '../test/harness.js';
import { ID, people, resetStaff } from '../test/people.js';

let h: Awaited<ReturnType<typeof startApp>>;
let p: ReturnType<typeof people>;
const { db, pool } = createDb();
const cleanup: (() => Promise<unknown>)[] = [];
beforeAll(async () => { h = await startApp(); p = people(h); await import('../db/seed.js'); await resetStaff(db); });
afterAll(async () => { for (const c of cleanup) await c(); await h?.app.close(); await pool.end(); });

const home = { address: '18 Birch Ave', city: 'Oakville', type: 'House', beds: 4, baths: 3, sqft: 2200, yearBuilt: 1998, annualTax: 6200, listPrice: 989_000, mortgageBalance: 310_000 };
const mail = (to: string) => h.outbox.filter(m => m.to === to).at(-1)!;

describe('selling with Klyr', () => {
  it('estimates the net, signs the listing agreement, preps and publishes a Klyr listing', async () => {
    const t = await h.signedIn();
    const email = (await h.call('GET', '/auth/me', undefined, t)).body.email;
    expect((await h.call('GET', '/selling', undefined, t)).body.code).toBe('not_selling');
    expect((await h.call('POST', '/selling', { ...home, listPrice: 1000 }, t)).status).toBe(400);
    const s = (await h.call('POST', '/selling', home, t)).body;
    expect(s).toMatchObject({ stage: 'preparing', plan: 'flat', coop: 0.025, listPrice: 989_000, agreement: null });
    expect(s.nets.flat).toBeGreaterThan(s.nets.percent);
    expect(s.net.mortgage).toBe(310_000);
    expect((await h.call('POST', '/selling', home, t)).body.code).toBe('already_selling');

    // The seller chooses the plan and the co-op.
    const planned = (await h.call('PUT', '/selling/plan', { plan: 'percent', coop: 0.02, listPrice: 999_000, mortgageBalance: 310_000 }, t)).body;
    expect(planned).toMatchObject({ plan: 'percent', coop: 0.02, listPrice: 999_000 });
    expect(planned.net.fee).toBe(Math.round(999_000 * 0.01 * 1.13));

    // Form 200 needs an ID check and a fresh confirmation.
    expect((await h.call('POST', '/selling/agreement/sign', { typedName: 'Test Buyer', readConfirmed: true }, t)).body.code).toBe('step_up_required');
    await p.stepUp(t, email);
    expect((await h.call('POST', '/selling/agreement/sign', { typedName: 'Test Buyer', readConfirmed: true }, t)).body.code).toBe('id_required');
    await h.call('POST', '/id-check', ID, t);
    const signed = (await h.call('POST', '/selling/agreement/sign', { typedName: 'Test Buyer', readConfirmed: true }, t)).body;
    expect(signed.agreement).not.toBeNull();
    const doc = (await h.call('GET', `/documents/${signed.agreement.documentId}`, undefined, t)).body;
    expect(doc.record).toMatchObject({ form: '200', title: 'Listing Agreement' });
    expect(doc.record.clauses.find((c: [string, string]) => c[0] === 'Buyer’s brokerage')[1]).toMatch(/^2\.0% of the sale price/);
    expect((await h.call('PUT', '/selling/plan', { plan: 'flat', coop: 0.025, listPrice: 999_000, mortgageBalance: 0 }, t)).body.code).toBe('already_signed');

    // Prep: seller steps, agent steps, then publish.
    expect((await h.call('POST', '/selling/tasks', { key: 'photos' }, t)).body.code).toBe('agent_only');
    expect((await h.call('POST', '/selling/tasks', { key: 'payout', lender: 'Pine Bank', balance: 305_000 }, t)).body.mortgageBalance).toBe(305_000);
    await h.call('POST', '/selling/tasks', { key: 'rules', offerDate: 'Tue Nov 3 · 7 pm', showings: '30-minute slots, 24 h notice' }, t);
    const agentEmail = (await h.call('GET', '/selling', undefined, t)).body.agent.name === 'Maya Chen' ? 'maya.chen@klyr.example' : 'daniel.okafor@klyr.example';
    const agent = await p.staff(agentEmail);
    const mine = (await h.call('GET', '/pro/listings', undefined, agent)).body.find((d: { dealId: string }) => d.dealId === s.dealId);
    expect(mine).toMatchObject({ stage: 'preparing', clientName: 'Test Buyer' });
    const publish = (b = {}) => h.call('POST', `/pro/listings/${s.dealId}/publish`, { lat: 43.4675, lng: -79.6877, photos: ['https://media.example/18-birch/1.jpg'], ...b }, agent);
    expect((await publish()).body.code).toBe('prep_incomplete');
    await h.call('POST', '/selling/tasks', { key: 'approve', description: 'Four-bedroom family home on a quiet crescent.', inclusions: 'Fridge, stove, washer, dryer' }, t);
    await h.call('POST', `/pro/listings/${s.dealId}/tasks`, { key: 'photos', note: 'Lumen Media, Oct 30' }, agent);
    const other = await p.staff(agentEmail === 'maya.chen@klyr.example' ? 'daniel.okafor@klyr.example' : 'maya.chen@klyr.example');
    expect((await h.call('POST', `/pro/listings/${s.dealId}/publish`, { lat: 43.4675, lng: -79.6877 }, other)).status).toBe(404);
    expect((await publish({ lat: 10 })).status).toBe(400);
    const { listingId } = (await publish()).body;
    cleanup.push(() => db.update(listings).set({ status: 'terminated' }).where(eq(listings.id, listingId)));
    expect(mail(email).subject).toBe('You’re live · 18 Birch Ave');
    expect((await h.call('GET', '/selling', undefined, t)).body).toMatchObject({ stage: 'listed', listingId });
    expect((await publish()).body.code).toBe('already_listed');

    // Buyers find it, and a Klyr buyer can't offer without Form 326.
    const b = await p.readyBuyer();
    const found = (await h.call('GET', '/listings?city=Oakville', undefined, b.t)).body.results.find((l: { id: string }) => l.id === listingId);
    expect(found).toMatchObject({ address: '18 Birch Ave', price: 999_000, listingBrokerage: 'Klyr Realty Inc., Brokerage' });
    expect(found.photos[0].url).toBe('https://media.example/18-birch/1.jpg');
    const offer = await h.call('PUT', '/offers/draft', {
      listingId, price: 990_000, deposit: 40_000, financingDays: 5, inspectionDays: 5, statusCertificateDays: null,
      irrevocableAt: new Date(Date.now() + 86_400_000).toISOString(), closingDate: '2027-01-15', inclusions: 'Appliances', exclusions: '', noteToAgent: '',
    }, b.t);
    expect(offer.body.code).toBe('multiple_representation');
  });
});
