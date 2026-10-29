import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bankingDayDeadline, nextBankingDate } from '@klyr/core';
import { createDb } from '../db/client.js';
import { offers, sessions } from '../db/schema.js';
import { startApp } from '../test/harness.js';
import { inMin, people, resetStaff } from '../test/people.js';

let h: Awaited<ReturnType<typeof startApp>>;
let p: ReturnType<typeof people>;
const { db, pool } = createDb();
beforeAll(async () => { h = await startApp(); p = people(h); await import('../db/seed.js'); await resetStaff(db); });
afterAll(async () => { await h?.app.close(); await pool.end(); });

const ymd = (days: number) => nextBankingDate(new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10));
type Listing = { id: string; address: string; price: number; type: string; listingBrokerage: string };
async function homes(t: string) { return (await h.call('GET', '/listings', undefined, t)).body.results as Listing[]; }
/** Valid terms for a home, with overrides. */
const terms = (l: Listing, o: Record<string, unknown> = {}) => ({
  listingId: l.id, price: l.price, deposit: 50_000, financingDays: 5, inspectionDays: 5, statusCertificateDays: null,
  irrevocableAt: inMin(24 * 60), closingDate: ymd(60), inclusions: 'Fridge, stove, washer, dryer', exclusions: '', noteToAgent: '', ...o,
});
/** Lets the session's last strong check go stale, so signing asks again. */
async function staleCheck(t: string) {
  const sid = (await h.call('GET', '/auth/sessions', undefined, t)).body.find((s: { current: boolean }) => s.current).id;
  await db.update(sessions).set({ mfaAt: new Date(Date.now() - 60 * 60_000) }).where(eq(sessions.id, sid));
}
const mail = (to: string) => h.outbox.filter(m => m.to === to).at(-1)!;

describe('building an offer', () => {
  it('needs Form 300 and ID first, starts from sensible defaults, and checks the terms', async () => {
    const newcomer = await h.signedIn();
    const house = (await homes(newcomer)).find(l => l.type === 'House')!;
    expect((await h.call('PUT', '/offers/draft', terms(house), newcomer)).body.code).toBe('not_ready');

    const b = await p.readyBuyer();
    const start = (await h.call('GET', `/offers/start?listingId=${house.id}`, undefined, b.t)).body;
    expect(start.draft).toBeNull();
    expect(start.defaults).toMatchObject({ price: house.price, financingDays: 5, inspectionDays: 5, statusCertificateDays: null });
    expect(start.defaults.deposit).toBe(Math.round(house.price * 0.05 / 1000) * 1000);
    expect(start.defaults.irrevocableAt).toMatch(/T23:59:00-0[45]:00$/);
    const condo = (await homes(b.t)).find(l => l.type === 'Condo')!;
    expect((await h.call('GET', `/offers/start?listingId=${condo.id}`, undefined, b.t)).body.defaults).toMatchObject({ inspectionDays: null, statusCertificateDays: 5 });

    const bad = async (o: Record<string, unknown>) => (await h.call('PUT', '/offers/draft', terms(house, o), b.t)).body.code;
    expect(await bad({ price: Math.round(house.price * 0.4) })).toBe('bad_price');
    expect(await bad({ deposit: house.price })).toBe('bad_deposit');
    expect(await bad({ irrevocableAt: inMin(30) })).toBe('bad_irrevocable');
    expect(await bad({ irrevocableAt: inMin(8 * 24 * 60) })).toBe('bad_irrevocable');
    expect(await bad({ closingDate: ymd(5) })).toBe('bad_closing');
    expect(await bad({ closingDate: '2027-01-02' })).toBe('closing_not_banking_day'); // a Saturday
    expect(start.defaults.closingDate).toBe(nextBankingDate(start.defaults.closingDate));
    expect((await h.call('PUT', '/offers/draft', terms(house, { financingDays: 11 }), b.t)).status).toBe(400);

    const d1 = (await h.call('PUT', '/offers/draft', terms(house, { statusCertificateDays: 5 }), b.t)).body;
    expect(d1).toMatchObject({ status: 'draft', form: '100', price: house.price });
    expect(d1.terms.statusCertificateDays).toBeNull(); // houses have no status certificate
    expect(d1.allIn).toBeGreaterThan(0);
    const d2 = (await h.call('PUT', '/offers/draft', terms(house, { price: house.price - 20_000 }), b.t)).body;
    expect(d2.id).toBe(d1.id); // one draft per home
    expect(d2.allIn).toBeLessThan(d1.allIn);
    expect((await h.call('GET', `/offers/start?listingId=${house.id}`, undefined, b.t)).body.draft.id).toBe(d1.id);
  });
});

describe('an offer through to acceptance', () => {
  it('is signed by the buyer, reviewed by the agent, signed back by the seller and accepted', async () => {
    const b = await p.readyBuyer();
    const agent = await p.staff(b.agentEmail);
    const token = `ExponentPushToken[offers-${Date.now()}]`;
    await h.call('POST', '/pro/devices', { token, platform: 'android' }, agent);
    const house = (await homes(b.t)).find(l => l.type === 'House')!;
    const draft = (await h.call('PUT', '/offers/draft', terms(house, { price: house.price - 10_000, noteToAgent: 'Can we close sooner?' }), b.t)).body;

    // Signing needs a fresh check and the buyer's legal name.
    await staleCheck(b.t);
    expect((await h.call('POST', `/offers/${draft.id}/sign`, { typedName: 'Test Buyer', readConfirmed: true }, b.t)).body.code).toBe('step_up_required');
    await p.stepUp(b.t, b.email);
    expect((await h.call('POST', `/offers/${draft.id}/sign`, { typedName: 'Someone Else', readConfirmed: true }, b.t)).body.code).toBe('name_mismatch');
    const sent = (await h.call('POST', `/offers/${draft.id}/sign`, { typedName: 'test  buyer', readConfirmed: true }, b.t)).body;
    expect(sent).toMatchObject({ status: 'sent', form: '100' });
    const doc = (await h.call('GET', `/documents/${sent.documentId}`, undefined, b.t)).body;
    expect(doc.record).toMatchObject({ form: '100', title: 'Agreement of Purchase and Sale', signer: { typedName: 'test  buyer' } });
    expect(doc.record.clauses.map((c: [string, string]) => c[0])).toEqual(['Price', 'Deposit', 'Irrevocable', 'Completion', 'Included', 'Financing', 'Inspection']);
    expect(doc.record.clauses[1][1]).toContain(`payable to ${house.listingBrokerage} in trust`);
    expect(h.pushes.filter(m => m.to === token).at(-1)).toMatchObject({ title: 'Offer to review', data: { screen: 'offers', offerId: draft.id } });
    expect(mail(b.agentEmail).subject).toBe(`Offer to review · ${house.address}`);
    expect((await h.call('PUT', '/offers/draft', terms(house), b.t)).body.code).toBe('offer_open');

    // The agent returns it once; the buyer changes it and signs again.
    expect((await h.call('POST', `/pro/offers/${draft.id}/result`, { result: 'accepted' }, agent)).body.code).toBe('not_registered');
    expect((await h.call('POST', `/pro/offers/${draft.id}/review`, { action: 'return', note: 'Add the dishwasher to the inclusions.' }, agent)).body.status).toBe('returned');
    expect(mail(b.email).text).toContain('Add the dishwasher');
    const again = (await h.call('PUT', '/offers/draft', terms(house, { price: house.price - 10_000, inclusions: 'Fridge, stove, dishwasher' }), b.t)).body;
    expect(again).toMatchObject({ id: draft.id, status: 'returned', agentNote: 'Add the dishwasher to the inclusions.' });
    await p.stepUp(b.t, b.email);
    expect((await h.call('POST', `/offers/${draft.id}/sign`, { typedName: 'Test Buyer', readConfirmed: true }, b.t)).body.status).toBe('sent');

    // Registered with the listing brokerage, then signed back $10,000 higher.
    expect((await h.call('POST', `/pro/offers/${draft.id}/review`, { action: 'register', note: '3 offers registered.' }, agent)).body.status).toBe('registered');
    expect(mail(b.email).subject).toBe(`Your offer is with the seller · ${house.address}`);
    const listed = (await h.call('GET', '/pro/offers', undefined, agent)).body.find((o: { id: string }) => o.id === draft.id);
    expect(listed).toMatchObject({ status: 'registered', clientName: 'Test Buyer' });
    expect((await h.call('POST', `/pro/offers/${draft.id}/result`, { result: 'signed_back', price: house.price, irrevocableAt: inMin(20) }, agent)).body.code).toBe('bad_irrevocable');
    const back = (await h.call('POST', `/pro/offers/${draft.id}/result`, { result: 'signed_back', price: house.price, irrevocableAt: inMin(6 * 60), note: 'Seller wants asking.' }, agent)).body;
    expect(back.status).toBe('signed_back');
    const mine = (await h.call('GET', `/offers/${draft.id}`, undefined, b.t)).body;
    expect(mine).toMatchObject({ status: 'signed_back', signBack: { id: back.signBackId, price: house.price, status: 'signed_back', agentNote: 'Seller wants asking.' } });

    // Accepting the sign-back is a signature too.
    await staleCheck(b.t);
    expect((await h.call('POST', `/offers/${back.signBackId}/respond`, { decision: 'accept', typedName: 'Test Buyer', readConfirmed: true }, b.t)).body.code).toBe('step_up_required');
    await p.stepUp(b.t, b.email);
    const before = Date.now();
    const done = (await h.call('POST', `/offers/${back.signBackId}/respond`, { decision: 'accept', typedName: 'Test Buyer', readConfirmed: true }, b.t)).body;
    expect(done).toMatchObject({ id: draft.id, signBack: { status: 'accepted' } });
    expect(h.pushes.filter(m => m.to === token).at(-1)!.title).toBe('Your client accepted the sign-back');
    expect(mail(b.email).subject).toBe(`Accepted · ${house.address}`);

    const deal = (await h.call('GET', '/deal', undefined, b.t)).body;
    expect(deal).toMatchObject({ stage: 'conditional', price: house.price, address: house.address, deposit: { amount: 50_000, holder: house.listingBrokerage, receivedAt: null } });
    expect(Date.parse(deal.deposit.dueAt) - before).toBeGreaterThan(23.9 * 3600_000);
    expect(deal.conditions.map((c: { kind: string }) => c.kind).sort()).toEqual(['financing', 'inspection']);
    expect(deal.conditions[0].dueAt).toBe(bankingDayDeadline(new Date(deal.acceptedAt), 5).toISOString());

    // The agent confirms the deposit arrived, once.
    const other = await p.staff(b.agentEmail === 'maya.chen@klyr.example' ? 'daniel.okafor@klyr.example' : 'maya.chen@klyr.example');
    expect((await h.call('POST', `/pro/deals/${deal.dealId}/deposit-received`, undefined, other)).status).toBe(404);
    expect((await h.call('POST', `/pro/deals/${deal.dealId}/deposit-received`, undefined, agent)).status).toBe(200);
    expect(mail(b.email).subject).toBe('Your deposit was received');
    expect((await h.call('GET', '/deal', undefined, b.t)).body.deposit.receivedAt).not.toBeNull();
    expect((await h.call('POST', `/pro/deals/${deal.dealId}/deposit-received`, undefined, agent)).body.code).toBe('no_deposit_due');
  });

  it('makes a deal firm when there are no conditions, and uses Form 101 with a status certificate for condos', async () => {
    const b = await p.readyBuyer();
    const agent = await p.staff(b.agentEmail);
    const condo = (await homes(b.t)).find(l => l.type === 'Condo')!;
    const draft = (await h.call('PUT', '/offers/draft', terms(condo, { financingDays: null, inspectionDays: null, statusCertificateDays: 5 }), b.t)).body;
    expect(draft.form).toBe('101');
    await p.stepUp(b.t, b.email);
    const sent = (await h.call('POST', `/offers/${draft.id}/sign`, { typedName: 'Test Buyer', readConfirmed: true }, b.t)).body;
    const doc = (await h.call('GET', `/documents/${sent.documentId}`, undefined, b.t)).body;
    expect(doc.record).toMatchObject({ form: '101', title: 'Agreement of Purchase and Sale – Condominium Resale' });
    expect(doc.record.clauses.at(-1)[0]).toBe('Status certificate');

    await h.call('POST', `/pro/offers/${draft.id}/review`, { action: 'register' }, agent);
    expect((await h.call('POST', `/pro/offers/${draft.id}/result`, { result: 'accepted' }, agent)).body.status).toBe('accepted');
    expect((await h.call('GET', '/deal', undefined, b.t)).body).toMatchObject({ stage: 'conditional', conditions: [{ kind: 'status_certificate' }] });

    // A buyer with no conditions is firm the moment it's accepted.
    const c = await p.readyBuyer();
    const cAgent = await p.staff(c.agentEmail);
    const house = (await homes(c.t)).find(l => l.type === 'House')!;
    const firm = (await h.call('PUT', '/offers/draft', terms(house, { financingDays: null, inspectionDays: null }), c.t)).body;
    await p.stepUp(c.t, c.email);
    await h.call('POST', `/offers/${firm.id}/sign`, { typedName: 'Test Buyer', readConfirmed: true }, c.t);
    const doc2 = (await h.call('GET', `/documents/${(await h.call('GET', `/offers/${firm.id}`, undefined, c.t)).body.documentId}`, undefined, c.t)).body;
    expect(doc2.record.clauses.at(-1)).toEqual(['Conditions', 'None. Once accepted, the agreement is firm and binding.']);
    await h.call('POST', `/pro/offers/${firm.id}/review`, { action: 'register' }, cAgent);
    await h.call('POST', `/pro/offers/${firm.id}/result`, { result: 'accepted' }, cAgent);
    expect((await h.call('GET', '/deal', undefined, c.t)).body).toMatchObject({ stage: 'firm', conditions: [] });
  });
});

describe('offers that don’t go ahead', () => {
  it('can be withdrawn, are rejected by the seller, or expire at the irrevocable time', async () => {
    const b = await p.readyBuyer();
    const agent = await p.staff(b.agentEmail);
    const [one, two, three] = (await homes(b.t)).filter(l => l.type !== 'Condo');
    const signed = async (l: Listing) => {
      const d = (await h.call('PUT', '/offers/draft', terms(l), b.t)).body;
      await p.stepUp(b.t, b.email);
      await h.call('POST', `/offers/${d.id}/sign`, { typedName: 'Test Buyer', readConfirmed: true }, b.t);
      return d.id as string;
    };

    const w = await signed(one!);
    expect((await h.call('DELETE', `/offers/${w}`, undefined, b.t)).status).toBe(200);
    expect((await h.call('GET', `/offers/${w}`, undefined, b.t)).body.status).toBe('withdrawn');
    expect((await h.call('POST', `/pro/offers/${w}/review`, { action: 'register' }, agent)).body.code).toBe('not_sent');
    expect((await h.call('PUT', '/offers/draft', terms(one!), b.t)).body.status).toBe('draft'); // a new offer can start

    const r = await signed(two!);
    await h.call('POST', `/pro/offers/${r}/review`, { action: 'register' }, agent);
    expect((await h.call('POST', `/pro/offers/${r}/result`, { result: 'rejected', note: 'Went with a firm offer.' }, agent)).body.status).toBe('rejected');
    expect(mail(b.email).text).toContain('Went with a firm offer.');
    expect((await h.call('DELETE', `/offers/${r}`, undefined, b.t)).body.code).toBe('not_open');

    const x = await signed(three!);
    await h.call('POST', `/pro/offers/${x}/review`, { action: 'register' }, agent);
    await db.update(offers).set({ irrevocableAt: new Date(Date.now() - 60_000) }).where(eq(offers.id, x));
    expect((await h.call('GET', `/offers/${x}`, undefined, b.t)).body.status).toBe('expired');
    expect((await h.call('POST', `/pro/offers/${x}/result`, { result: 'accepted' }, agent)).body.code).toBe('not_registered');
    expect((await h.call('GET', '/deal', undefined, b.t)).body.code).toBe('no_deal');
  });
});
