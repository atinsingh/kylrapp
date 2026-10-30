import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { totpAt, totpStep } from '../identity/crypto.js';
import { startApp } from '../test/harness.js';

let h: Awaited<ReturnType<typeof startApp>>;
beforeAll(async () => { h = await startApp(); await import('../db/seed.js'); });
afterAll(async () => { await h?.app.close(); });

const ID_ANSWERS = { occupation: 'Nurse', sourceOfFunds: ['savings'], actingForThirdParty: false, politicallyExposed: false, buyingAs: 'self', vendorRef: 'sandbox' };
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const lastCode = (email: string) => h.outbox.filter(m => m.to === email).at(-1)!.text.match(/\b(\d{6})\b/)![1];

/** Email-only buyer confirms with an emailed code, then signs Form 300. */
async function signed(token: string, email: string, name = 'Test Buyer') {
  await h.call('POST', '/auth/stepup/email/start', undefined, token);
  expect((await h.call('POST', '/auth/stepup/email/verify', { code: lastCode(email) }, token)).status).toBe(200);
  const r = await h.call('POST', '/agreements/300/sign', { typedName: name, readConfirmed: true }, token);
  expect(r.status).toBe(201);
  return r.body;
}

describe('first visit', () => {
  it('lets a buyer confirm by email right after signing up (the wait is per kind of code)', async () => {
    const { config } = await import('../config.js');
    const saved = config.emailCode.cooldownSeconds;
    (config.emailCode as { cooldownSeconds: number }).cooldownSeconds = 30;
    try {
      const t = await h.signedIn(); // a sign-up code was just sent
      expect((await h.call('POST', '/auth/stepup/email/start', undefined, t)).status).toBe(202);
      expect((await h.call('POST', '/auth/stepup/email/start', undefined, t)).status).toBe(429);
    } finally { (config.emailCode as { cooldownSeconds: number }).cooldownSeconds = saved; }
  });

  it('needs Form 300 (with a fresh check) and an ID check, then books, lists and cancels', async () => {
    const t = await h.signedIn();
    const me = (await h.call('GET', '/auth/me', undefined, t)).body;
    const buying = (await h.call('GET', '/buying', undefined, t)).body;
    expect(buying).toMatchObject({ agreement: { signed: false }, idCheck: { status: 'not_started' }, canBookVisits: false });
    expect(buying.agent).toMatchObject({ title: 'Salesperson', brokerage: 'Klyr Realty Inc., Brokerage' });

    const terms = (await h.call('GET', '/agreements/300', undefined, t)).body;
    expect(terms.buyer).toBe('Test Buyer');
    expect(terms.clauses.map((c: string[]) => c[0])).toEqual(['Term', 'Area and type', 'What Klyr is paid', 'Cash back', 'Holdover', 'Representation']);

    // No fresh check yet: refused.
    expect((await h.call('POST', '/agreements/300/sign', { typedName: 'Test Buyer', readConfirmed: true }, t)).body.code).toBe('step_up_required');
    await h.call('POST', '/auth/stepup/email/start', undefined, t);
    await h.call('POST', '/auth/stepup/email/verify', { code: lastCode(me.email) }, t);
    expect((await h.call('POST', '/agreements/300/sign', { typedName: 'Someone Else', readConfirmed: true }, t)).body.code).toBe('name_mismatch');
    const sig = (await h.call('POST', '/agreements/300/sign', { typedName: '  test   buyer ', readConfirmed: true }, t)).body;
    expect(sig.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await h.call('POST', '/agreements/300/sign', { typedName: 'Test Buyer', readConfirmed: true }, t)).status).toBe(409);

    // The stored record is what was signed, and its hash matches.
    const docs = (await h.call('GET', '/documents', undefined, t)).body;
    expect(docs).toHaveLength(1);
    const doc = (await h.call('GET', `/documents/${docs[0].id}`, undefined, t)).body;
    expect(doc.record.signer.typedName).toBe('test   buyer');
    expect(doc.record.clauses).toEqual(terms.clauses);
    expect(createHash('sha256').update(JSON.stringify(doc.record, null, 2)).digest('hex')).toBe(doc.sha256);

    const listingId = (await h.call('GET', '/listings', undefined, t)).body.results[0].id;
    expect((await h.call('POST', '/showings', { listingId, at: inDays(2) }, t)).body.code).toBe('id_required');

    expect((await h.call('POST', '/id-check', { ...ID_ANSWERS, vendorRef: 'forged' }, t)).status).toBe(400);
    expect((await h.call('POST', '/id-check', ID_ANSWERS, t)).body.status).toBe('verified');
    expect((await h.call('GET', '/buying', undefined, t)).body.canBookVisits).toBe(true);

    expect((await h.call('POST', '/showings', { listingId, at: inDays(-1) }, t)).body.code).toBe('bad_time');
    expect((await h.call('POST', '/showings', { listingId, at: inDays(30) }, t)).body.code).toBe('bad_time');
    const visit = await h.call('POST', '/showings', { listingId, at: inDays(2), note: 'Can we see the basement?' }, t);
    expect(visit.status).toBe(201);
    expect(visit.body.status).toBe('requested');
    expect((await h.call('POST', '/showings', { listingId, at: inDays(3) }, t)).body.code).toBe('already_booked');

    const list = (await h.call('GET', '/showings', undefined, t)).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ listingId, status: 'requested', note: 'Can we see the basement?' });
    expect(list[0].photo.url).toMatch(/\/media\//);
    expect((await h.call('DELETE', `/showings/${visit.body.id}`, undefined, t)).status).toBe(200);
    expect((await h.call('DELETE', `/showings/${visit.body.id}`, undefined, t)).status).toBe(404);
    expect((await h.call('GET', '/showings', undefined, t)).body[0].status).toBe('cancelled');

    // Another buyer can't see or cancel it.
    const other = await h.signedIn();
    expect((await h.call('GET', '/showings', undefined, other)).body).toEqual([]);
    expect((await h.call('GET', `/documents/${docs[0].id}`, undefined, other)).status).toBe(404);
  });

  it('sends politically exposed buyers to compliance review before visits', async () => {
    const t = await h.signedIn();
    const me = (await h.call('GET', '/auth/me', undefined, t)).body;
    await signed(t, me.email);
    expect((await h.call('POST', '/id-check', { ...ID_ANSWERS, politicallyExposed: true }, t)).body.status).toBe('needs_review');
    const listingId = (await h.call('GET', '/listings', undefined, t)).body.results[0].id;
    const r = await h.call('POST', '/showings', { listingId, at: inDays(2) }, t);
    expect(r.body.code).toBe('id_required');
    expect(r.body.message).toMatch(/compliance officer/);
  });

  it('does not let email confirmation replace a stronger factor', async () => {
    const t = await h.signedIn();
    const setup = (await h.call('POST', '/auth/mfa/totp/setup', undefined, t)).body;
    await h.call('POST', '/auth/mfa/totp/enable', { code: totpAt(setup.secret, totpStep()) }, t);
    expect((await h.call('POST', '/auth/stepup/email/start', undefined, t)).body.code).toBe('use_strong_factor');
  });
});
