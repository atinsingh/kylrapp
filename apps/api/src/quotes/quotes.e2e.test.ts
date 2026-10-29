import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { startApp } from '../test/harness.js';
import { people, resetStaff } from '../test/people.js';

let h: Awaited<ReturnType<typeof startApp>>;
let p: ReturnType<typeof people>;
const { db, pool } = createDb();
beforeAll(async () => { h = await startApp(); p = people(h); await import('../db/seed.js'); await resetStaff(db); });
afterAll(async () => { await h?.app.close(); await pool.end(); });
const mail = (to: string) => h.outbox.filter(m => m.to === to).at(-1)!;

describe('provider marketplace', () => {
  it('ranks quotes by what the client pays and discloses referral fees before the choice', async () => {
    const lonely = await h.signedIn();
    expect((await h.call('POST', '/quotes/requests', { kind: 'inspector', providerIds: [crypto.randomUUID()] }, lonely)).body.code).toBe('agreement_required');

    const b = await p.readyBuyer();
    const lenders = (await h.call('GET', '/providers?kind=lender', undefined, b.t)).body as { id: string; name: string; paysReferral: boolean }[];
    expect(lenders.map(l => l.name)).toEqual(['Lakeshore Credit Union (sample)', 'Maple Mortgage Co. (sample)', 'Summit Mortgage Brokers (sample)']);
    const lawyers = (await h.call('GET', '/providers?kind=lawyer', undefined, b.t)).body as { id: string; paysReferral: boolean }[];
    expect(lawyers.every(l => !l.paysReferral)).toBe(true);
    const [lake, maple, summit] = lenders;

    const reqs = (await h.call('POST', '/quotes/requests', { kind: 'lender', providerIds: lenders.map(l => l.id), loan: 800_000, amortYears: 25 }, b.t)).body;
    expect(reqs[0]).toMatchObject({ kind: 'lender', status: 'open', quotes: [] });
    expect((await h.call('POST', '/quotes/requests', { kind: 'lender', providerIds: [maple!.id], loan: 800_000, amortYears: 25 }, b.t)).body.code).toBe('request_open');
    expect((await h.call('POST', '/quotes/requests', { kind: 'lawyer', providerIds: [maple!.id], price: 1_000_000 }, b.t)).body.code).toBe('bad_provider');

    // The agent enters quotes from each lender's own system.
    const agent = await p.staff(b.agentEmail);
    const enter = (q: object) => h.call('POST', `/pro/quotes/requests/${reqs[0].id}`, { kind: 'lender', validDays: 30, prepaymentPct: 20, approvalDays: 2, ...q }, agent);
    expect((await enter({ providerId: lake!.id, rate: 0.0424, fees: 0, referralFee: 500 })).body.code).toBe('no_referral_agreement');
    await enter({ providerId: lake!.id, rate: 0.0424, fees: 0, referralFee: 0 });
    await enter({ providerId: maple!.id, rate: 0.0429, fees: 0, referralFee: 1000 });
    const list = (await enter({ providerId: summit!.id, rate: 0.0419, fees: 2500, referralFee: 1500 })).body;
    expect(list.clientName).toBe('Test Buyer');

    // Ranked by 5-year cost (interest + fees), never by the referral fee.
    const mine = (await h.call('GET', '/quotes', undefined, b.t)).body[0];
    const costs = mine.quotes.map((q: { clientCost: number }) => q.clientCost);
    expect(costs).toEqual([...costs].sort((x: number, y: number) => x - y));
    expect(mine.quotes[0].vsBest).toBe(0);
    expect(mine.quotes.find((q: { provider: { name: string } }) => q.provider.name.startsWith('Maple')).details.monthly).toBe(4335);
    expect(mine.providers.every((x: { quoted: boolean }) => x.quoted)).toBe(true);

    // A lawyer can't pay a referral fee.
    const lreq = (await h.call('POST', '/quotes/requests', { kind: 'lawyer', providerIds: [lawyers[0]!.id], price: 1_000_000 }, b.t)).body.find((r: { kind: string }) => r.kind === 'lawyer');
    expect((await h.call('POST', `/pro/quotes/requests/${lreq.id}`, { kind: 'lawyer', providerId: lawyers[0]!.id, fee: 1400, disbursements: 450, titleInsurance: 350, referralFee: 200, validDays: 30 }, agent)).body.code).toBe('lawyer_referral');
    const lq = (await h.call('POST', `/pro/quotes/requests/${lreq.id}`, { kind: 'lawyer', providerId: lawyers[0]!.id, fee: 1400, disbursements: 450, titleInsurance: 350, referralFee: 0, validDays: 30 }, agent)).body;
    expect(lq.quotes[0].clientCost).toBe(Math.round(1400 * 1.13) + 450 + 350);

    // Choosing a quote that pays Klyr needs the written acknowledgement; the email repeats the disclosure.
    const summitQ = mine.quotes.find((q: { provider: { name: string } }) => q.provider.name.startsWith('Summit'));
    expect((await h.call('POST', `/quotes/${summitQ.id}/choose`, { referralAcknowledged: false }, b.t)).body.code).toBe('disclosure_required');
    const chosen = (await h.call('POST', `/quotes/${summitQ.id}/choose`, { referralAcknowledged: true }, b.t)).body.find((r: { kind: string }) => r.kind === 'lender');
    expect(chosen).toMatchObject({ status: 'chosen', chosenQuoteId: summitQ.id });
    expect(mail(b.email).text).toMatch(/Referral fee disclosure: Summit Mortgage Brokers \(sample\) pays Klyr Realty Inc\., Brokerage \$1,500/);
    expect(mail('team@summitmb.example').subject).toBe('Klyr client chose your quote');
    expect((await h.call('POST', `/quotes/${summitQ.id}/choose`, { referralAcknowledged: true }, b.t)).body.code).toBe('not_open');
  });
});
