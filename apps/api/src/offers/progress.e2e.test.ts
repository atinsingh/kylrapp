import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nextBankingDate } from '@klyr/core';
import { createDb } from '../db/client.js';
import { conditions, deposits } from '../db/schema.js';
import { startApp } from '../test/harness.js';
import { inMin, people, resetStaff } from '../test/people.js';
import { DealProgressService } from './progress.service.js';

let h: Awaited<ReturnType<typeof startApp>>;
let p: ReturnType<typeof people>;
const { db, pool } = createDb();
beforeAll(async () => { h = await startApp(); p = people(h); await import('../db/seed.js'); await resetStaff(db); });
afterAll(async () => { await h?.app.close(); await pool.end(); });

const mail = (to: string) => h.outbox.filter(m => m.to === to).at(-1)!;
const ymd = (days: number) => nextBankingDate(new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10));

/** A buyer whose offer (financing and inspection, 5 banking days) was just accepted. */
async function acceptedDeal(pick = 0) {
  const b = await p.readyBuyer();
  const agent = await p.staff(b.agentEmail);
  const house = (await h.call('GET', '/listings', undefined, b.t)).body.results.filter((l: { type: string }) => l.type !== 'Condo')[pick];
  const d = (await h.call('PUT', '/offers/draft', {
    listingId: house.id, price: house.price, deposit: 40_000, financingDays: 5, inspectionDays: 5, statusCertificateDays: null,
    irrevocableAt: inMin(24 * 60), closingDate: ymd(60), inclusions: 'Appliances', exclusions: '', noteToAgent: '',
  }, b.t)).body;
  await p.stepUp(b.t, b.email);
  await h.call('POST', `/offers/${d.id}/sign`, { typedName: 'Test Buyer', readConfirmed: true }, b.t);
  await h.call('POST', `/pro/offers/${d.id}/review`, { action: 'register' }, agent);
  expect((await h.call('POST', `/pro/offers/${d.id}/result`, { result: 'accepted' }, agent)).body.status).toBe('accepted');
  const deal = (await h.call('GET', '/deal', undefined, b.t)).body;
  return { b, agent, deal, house };
}
const sign = { typedName: 'Test Buyer', readConfirmed: true };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cond = (deal: { conditions: any[] }, kind: string) => deal.conditions.find(c => c.kind === kind)!;

describe('after acceptance', () => {
  it('records the trust-account call, then removes conditions once each signed notice is delivered', async () => {
    const { b, agent, deal } = await acceptedDeal();
    expect(deal).toMatchObject({ status: 'accepted', stage: 'conditional', deposit: { trustVerifiedAt: null } });

    // Trust account details confirmed by phone, by the client's own agent only.
    const other = await p.staff(b.agentEmail === 'maya.chen@klyr.example' ? 'daniel.okafor@klyr.example' : 'maya.chen@klyr.example');
    expect((await h.call('POST', `/pro/deals/${deal.dealId}/trust-verified`, { note: 'Called the front desk' }, other)).status).toBe(404);
    expect((await h.call('POST', `/pro/deals/${deal.dealId}/trust-verified`, { note: 'ok' }, agent)).status).toBe(400);
    await h.call('POST', `/pro/deals/${deal.dealId}/trust-verified`, { note: 'Spoke to Jo in accounting at 905-555-0100 (from their website)' }, agent);
    expect((await h.call('GET', '/deal', undefined, b.t)).body.deposit.trustVerifiedBy).toMatch(/: Spoke to Jo in accounting/);
    expect(mail(b.email).subject).toBe('Trust account details confirmed');

    // Form 123 needs a fresh check; it only counts once delivered.
    const fin = cond(deal, 'financing'), insp = cond(deal, 'inspection');
    expect((await h.call('POST', `/pro/conditions/${insp.id}/delivered`, undefined, agent)).body.code).toBe('not_signed');
    await p.stepUp(b.t, b.email);
    expect((await h.call('POST', `/deal/conditions/${fin.id}`, { ...sign, typedName: 'Not Me', action: 'waive' }, b.t)).body.code).toBe('name_mismatch');
    const after = (await h.call('POST', `/deal/conditions/${fin.id}`, { ...sign, action: 'waive' }, b.t)).body;
    expect(cond(after, 'financing')).toMatchObject({ deliveredAt: null });
    expect(cond(after, 'financing').waivedAt).not.toBeNull();
    const doc = (await h.call('GET', `/documents/${cond(after, 'financing').documentId}`, undefined, b.t)).body;
    expect(doc.record).toMatchObject({ form: '123', title: 'Waiver', condition: 'financing' });
    expect(mail(b.agentEmail).subject).toMatch(/^Deliver now · Waiver/);
    expect((await h.call('POST', `/deal/conditions/${fin.id}`, { ...sign, action: 'waive' }, b.t)).body.code).toBe('already_signed');

    expect((await h.call('POST', `/pro/conditions/${fin.id}/delivered`, undefined, agent)).body).toMatchObject({ firm: false });
    expect((await h.call('POST', `/pro/conditions/${fin.id}/delivered`, undefined, agent)).body.code).toBe('already_delivered');
    expect(mail(b.email).subject).toBe('Condition removed');
    await h.call('POST', `/deal/conditions/${insp.id}`, { ...sign, action: 'fulfil' }, b.t);
    expect((await h.call('POST', `/pro/conditions/${insp.id}/delivered`, undefined, agent)).body).toMatchObject({ firm: true });
    expect(mail(b.email).subject).toBe('Your deal is firm');
    expect((await h.call('GET', '/deal', undefined, b.t)).body.stage).toBe('firm');
    expect((await h.call('GET', '/pro/deals', undefined, agent)).body.find((d: { dealId: string }) => d.dealId === deal.dealId)).toMatchObject({ stage: 'firm', clientName: 'Test Buyer' });
  });

  it('reminds once before the deposit is due and before a condition ends', async () => {
    const { b, deal } = await acceptedDeal(1);
    const progress = h.app.get(DealProgressService);
    await db.update(deposits).set({ dueAt: new Date(Date.now() + 2 * 3600_000) }).where(eq(deposits.dealId, deal.dealId));
    await db.update(conditions).set({ dueAt: new Date(Date.now() + 20 * 3600_000) }).where(and(eq(conditions.dealId, deal.dealId), eq(conditions.kind, 'financing')));
    expect(await progress.remind()).toBeGreaterThanOrEqual(2);
    const subjects = h.outbox.filter(m => m.to === b.email).map(m => m.subject);
    expect(subjects).toContain('Deposit due soon');
    expect(subjects).toContain('Condition ends soon: financing');
    const count = subjects.length;
    await progress.remind();
    expect(h.outbox.filter(m => m.to === b.email).length).toBe(count);
  });

  it('voids the agreement when a condition lapses, then a release brings the deposit back', async () => {
    const { b, agent, deal, house } = await acceptedDeal(2);
    await db.update(conditions).set({ dueAt: new Date(Date.now() - 60_000) }).where(and(eq(conditions.dealId, deal.dealId), eq(conditions.kind, 'inspection')));
    const now = (await h.call('GET', '/deal', undefined, b.t)).body;
    expect(now).toMatchObject({ status: 'void', stage: 'touring', release: null });
    expect(cond(now, 'inspection').lapsedAt).not.toBeNull();
    expect(mail(b.email).subject).toBe(`Your agreement on ${house.address} has ended`);
    await p.stepUp(b.t, b.email);
    expect((await h.call('POST', `/deal/conditions/${cond(now, 'financing').id}`, { ...sign, action: 'waive' }, b.t)).body.code).toBe('agreement_void');
    expect((await h.call('POST', `/deal/conditions/${cond(now, 'inspection').id}`, { ...sign, action: 'waive' }, b.t)).body.code).toBe('condition_lapsed');

    expect((await h.call('POST', `/pro/deals/${deal.dealId}/deposit-returned`, undefined, agent)).body.code).toBe('release_needed');
    const released = (await h.call('POST', '/deal/release', sign, b.t)).body;
    expect(released.release).not.toBeNull();
    const doc = (await h.call('GET', `/documents/${released.release.documentId}`, undefined, b.t)).body;
    expect(doc.record).toMatchObject({ form: '122', title: 'Mutual Release' });
    expect((await h.call('POST', '/deal/release', sign, b.t)).body.code).toBe('already_signed');
    expect((await h.call('POST', `/pro/deals/${deal.dealId}/deposit-returned`, undefined, agent)).status).toBe(200);
    expect(mail(b.email).subject).toBe('Your deposit is on its way back');
    expect((await h.call('POST', `/pro/deals/${deal.dealId}/deposit-returned`, undefined, agent)).body.code).toBe('nothing_to_return');
    expect((await h.call('GET', '/deal', undefined, b.t)).body.deposit.returnedAt).not.toBeNull();

    // The buyer's representation carries on: a new offer on the same home can start.
    const again = await h.call('PUT', '/offers/draft', {
      listingId: house.id, price: house.price - 5000, deposit: 40_000, financingDays: 5, inspectionDays: 7, statusCertificateDays: null,
      irrevocableAt: inMin(24 * 60), closingDate: ymd(60), inclusions: 'Appliances', exclusions: '', noteToAgent: '',
    }, b.t);
    expect(again.body.status).toBe('draft');
  });
});
