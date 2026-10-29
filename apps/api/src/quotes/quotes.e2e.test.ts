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

  it('lets a provider send its own quote from the partner portal, seeing the client only once chosen', async () => {
    const officer = await p.staff('priya.nair@klyr.example');
    const b = await p.readyBuyer();
    const lenders = (await h.call('GET', '/providers?kind=lender', undefined, b.t)).body as { id: string; name: string }[];
    const maple = lenders.find(l => l.name.startsWith('Maple'))!, lake = lenders.find(l => l.name.startsWith('Lakeshore'))!;

    // Klyr Admin links a person to Maple; they sign in with a second factor like staff.
    const someone = await h.signedIn();
    const email = (await h.call('GET', '/auth/me', undefined, someone)).body.email as string;
    expect((await h.call('GET', '/partner/requests', undefined, someone)).status).toBe(403);
    expect((await h.call('POST', '/admin/partners', { email, orgId: maple.id, action: 'grant' }, b.t)).status).toBe(403);
    const linked = (await h.call('POST', '/admin/partners', { email, orgId: maple.id, action: 'grant' }, officer)).body;
    expect(linked.find((x: { email: string }) => x.email === email)).toMatchObject({ role: 'lender', orgId: maple.id });
    expect((await h.call('POST', '/admin/partners', { email, orgId: lake.id, action: 'grant' }, officer)).body.code).toBe('other_firm');
    const partner = await p.staff(email);
    expect((await h.call('GET', '/partner/me', undefined, partner)).body.org).toMatchObject({ name: 'Maple Mortgage Co. (sample)', referralAgreement: true });
    expect((await h.call('GET', '/pro/quotes', undefined, partner)).status).toBe(403);

    await h.call('POST', '/quotes/requests', { kind: 'lender', providerIds: [maple.id, lake.id], loan: 600_000, amortYears: 25, note: 'Self-employed, two years of returns' }, b.t);
    expect(mail('quotes@maplemortgage.example').subject).toBe('New mortgage quote request from a Klyr client');
    const [req] = (await h.call('GET', '/partner/requests', undefined, partner)).body;
    expect(req).toMatchObject({ kind: 'lender', status: 'open', details: { loan: 600_000, amortYears: 25 }, note: 'Self-employed, two years of returns', client: { name: 'Test' }, quote: null });
    expect(req.client.email).toBeUndefined();

    expect((await h.call('POST', `/partner/requests/${req.id}/quote`, { kind: 'lawyer', fee: 1, disbursements: 0, titleInsurance: 0, referralFee: 0, validDays: 30 }, partner)).body.code).toBe('wrong_kind');
    const sent = (await h.call('POST', `/partner/requests/${req.id}/quote`, { kind: 'lender', rate: 0.0419, fees: 0, prepaymentPct: 20, approvalDays: 1, referralFee: 800, validDays: 30 }, partner)).body[0];
    expect(sent.quote).toMatchObject({ referralFee: 800, source: 'partner' });
    const q = (await h.call('GET', '/quotes', undefined, b.t)).body[0].quotes[0];
    expect(q).toMatchObject({ provider: { name: 'Maple Mortgage Co. (sample)' }, referralFee: 800 });

    await h.call('POST', `/quotes/${q.id}/choose`, { referralAcknowledged: true }, b.t);
    const won = (await h.call('GET', '/partner/requests', undefined, partner)).body[0];
    expect(won).toMatchObject({ status: 'won', client: { name: 'Test Buyer', email: b.email } });
    expect((await h.call('POST', `/partner/requests/${req.id}/quote`, { kind: 'lender', rate: 0.04, fees: 0, prepaymentPct: 20, approvalDays: 1, referralFee: 0, validDays: 30 }, partner)).body.code).toBe('not_open');
    await h.call('POST', '/admin/partners', { email, orgId: maple.id, action: 'revoke' }, officer);
  });
});
