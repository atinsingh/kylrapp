import { and, eq, inArray, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { auditLog, emailCodes, showings, totpCredentials, users } from '../db/schema.js';
import { totpAt, totpStep } from '../identity/crypto.js';
import { startApp } from '../test/harness.js';

let h: Awaited<ReturnType<typeof startApp>>;
const { db, pool } = createDb();
beforeAll(async () => {
  h = await startApp();
  await import('../db/seed.js');
  // Seeded staff keep their authenticator and recent codes between runs; start each run clean.
  await db.delete(emailCodes).where(like(emailCodes.email, '%@klyr.example'));
  await db.delete(totpCredentials).where(inArray(totpCredentials.userId, db.select({ id: users.id }).from(users).where(like(users.email, '%@klyr.example'))));
});
afterAll(async () => { await h?.app.close(); await pool.end(); });

const inMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const lastCode = (email: string) => h.outbox.filter(m => m.to === email).at(-1)!.text.match(/\b(\d{6})\b/)![1]!;
const ID = { occupation: 'Nurse', sourceOfFunds: ['savings'], actingForThirdParty: false, politicallyExposed: false, buyingAs: 'self', vendorRef: 'sandbox' };
const AGENT_EMAIL: Record<string, string> = { 'Maya Chen': 'maya.chen@klyr.example', 'Daniel Okafor': 'daniel.okafor@klyr.example' };
const staffTokens = new Map<string, string>();

/** Staff sign in once per run: an email code, then setting up TOTP (which counts as the second factor). */
async function staff(email: string) {
  if (staffTokens.has(email)) return staffTokens.get(email)!;
  await h.call('POST', '/auth/email/start', { email });
  const t = (await h.call('POST', '/auth/email/verify', { email, code: lastCode(email) })).body.session.token as string;
  const setup = (await h.call('POST', '/auth/mfa/totp/setup', undefined, t)).body;
  expect((await h.call('POST', '/auth/mfa/totp/enable', { code: totpAt(setup.secret, totpStep()) }, t)).status).toBe(200);
  staffTokens.set(email, t);
  return t;
}

/** A buyer ready to book: Form 300 signed, ID checked. Returns token, email and their agent's email. */
async function readyBuyer(id = ID) {
  const t = await h.signedIn();
  const email = (await h.call('GET', '/auth/me', undefined, t)).body.email;
  await h.call('POST', '/auth/stepup/email/start', undefined, t);
  await h.call('POST', '/auth/stepup/email/verify', { code: lastCode(email) }, t);
  expect((await h.call('POST', '/agreements/300/sign', { typedName: 'Test Buyer', readConfirmed: true }, t)).status).toBe(201);
  await h.call('POST', '/id-check', id, t);
  const agent = (await h.call('GET', '/buying', undefined, t)).body.agent.name as string;
  return { t, email, agentEmail: AGENT_EMAIL[agent]! };
}

describe('Klyr Pro access', () => {
  it('is for staff only, and only after a second factor', async () => {
    const buyer = await h.signedIn();
    expect((await h.call('GET', '/pro/me', undefined, buyer)).body.code).toBe('not_staff');
    await h.call('POST', '/auth/email/start', { email: 'maya.chen@klyr.example' });
    const noMfa = (await h.call('POST', '/auth/email/verify', { email: 'maya.chen@klyr.example', code: lastCode('maya.chen@klyr.example') })).body.session.token;
    expect((await h.call('GET', '/pro/me', undefined, noMfa)).body.code).toBe('staff_mfa_required');
    const maya = await staff('maya.chen@klyr.example');
    expect((await h.call('GET', '/pro/me', undefined, maya)).body).toMatchObject({ name: 'Maya Chen', title: 'Salesperson', brokerage: 'Klyr Realty Inc., Brokerage' });
    expect((await h.call('GET', '/admin/id-reviews', undefined, maya)).body.code).toBe('not_staff');
  });
});

describe('visits', () => {
  it('lets the buyer’s own agent confirm, move and decline; the buyer is told', async () => {
    const b = await readyBuyer();
    const listingId = (await h.call('GET', '/listings', undefined, b.t)).body.results[0].id;
    const visit = (await h.call('POST', '/showings', { listingId, at: inMin(24 * 60) }, b.t)).body;
    const agent = await staff(b.agentEmail);
    const other = await staff(b.agentEmail === AGENT_EMAIL['Maya Chen'] ? AGENT_EMAIL['Daniel Okafor']! : AGENT_EMAIL['Maya Chen']!);

    const mine = (await h.call('GET', '/pro/showings', undefined, agent)).body.find((s: { id: string }) => s.id === visit.id);
    expect(mine).toMatchObject({ status: 'requested', clientName: 'Test Buyer' });
    expect((await h.call('GET', '/pro/showings', undefined, other)).body.some((s: { id: string }) => s.id === visit.id)).toBe(false);
    expect((await h.call('POST', `/pro/showings/${visit.id}/decide`, { action: 'confirm' }, other)).status).toBe(404);

    expect((await h.call('POST', `/pro/showings/${visit.id}/decide`, { action: 'confirm', note: 'Lockbox on the side door.' }, agent)).body.status).toBe('confirmed');
    expect(h.outbox.filter(m => m.to === b.email).at(-1)!.subject).toBe('Your visit is confirmed');
    expect((await h.call('GET', '/showings', undefined, b.t)).body[0]).toMatchObject({ status: 'confirmed', agentNote: 'Lockbox on the side door.' });

    const moved = (await h.call('POST', `/pro/showings/${visit.id}/decide`, { action: 'move', at: inMin(26 * 60), note: 'Seller asked for later.' }, agent)).body;
    expect(Date.parse(moved.at)).toBeGreaterThan(Date.parse(visit.at));
    expect(h.outbox.filter(m => m.to === b.email).at(-1)!.subject).toBe('Your visit has a new time');
    expect((await h.call('POST', `/pro/showings/${visit.id}/decide`, { action: 'decline' }, agent)).status).toBe(400); // needs a note
    expect((await h.call('POST', `/pro/showings/${visit.id}/decide`, { action: 'decline', note: 'Home sold firm this morning.' }, agent)).body.status).toBe('declined');
    // A declined visit doesn't hold the home: the buyer can pick another time.
    expect((await h.call('POST', '/showings', { listingId, at: inMin(30 * 60) }, b.t)).status).toBe(201);
  });
});

describe('geofenced check-in', () => {
  it('only checks in and completes at the property, near the visit time, after time on site', async () => {
    const b = await readyBuyer();
    const listing = (await h.call('GET', '/listings?city=Oakville', undefined, b.t)).body.results.find((l: { address: string }) => l.address === '9 Fern Ln');
    const visit = (await h.call('POST', '/showings', { listingId: listing.id, at: inMin(48 * 60) }, b.t)).body;
    const agent = await staff(b.agentEmail);
    await h.call('POST', `/pro/showings/${visit.id}/decide`, { action: 'confirm' }, agent);
    const near = { lat: listing.lat + 0.0004, lng: listing.lng, accuracyM: 12, platform: 'android' }; // about 45 m north
    const path = (step: string) => `/pro/showings/${visit.id}/${step}`;

    expect((await h.call('POST', path('check-in'), near, agent)).body.code).toBe('outside_window');
    await db.update(showings).set({ at: new Date(Date.now() + 10 * 60_000) }).where(eq(showings.id, visit.id)); // visit is now in 10 minutes

    const far = await h.call('POST', path('check-in'), { lat: 43.6532, lng: -79.3832, accuracyM: 10, platform: 'ios' }, agent); // downtown Toronto
    expect(far.body.code).toBe('too_far');
    expect(far.body.distanceM).toBeGreaterThan(20_000);
    expect((await h.call('POST', path('check-in'), { ...near, accuracyM: 400 }, agent)).body.code).toBe('low_accuracy');
    expect((await h.call('POST', path('check-in'), { ...near, mocked: true }, agent)).body.code).toBe('mocked_location');
    expect((await h.call('POST', path('check-in'), { ...near, platform: 'web' }, agent)).body.code).toBe('use_phone_app');
    expect((await h.call('POST', path('check-in'), { lat: near.lat, lng: near.lng, accuracyM: 12 }, agent)).status).toBe(400); // platform is required

    const ok = (await h.call('POST', path('check-in'), near, agent)).body;
    expect(ok.checkedIn).toBe(true);
    expect(ok.distanceM).toBeGreaterThan(30);
    expect(ok.distanceM).toBeLessThan(60);
    expect((await h.call('POST', path('check-in'), near, agent)).body.code).toBe('already_checked_in');

    expect((await h.call('POST', path('complete'), near, agent)).body.code).toBe('too_soon');
    await db.update(showings).set({ checkInAt: new Date(Date.now() - 11 * 60_000) }).where(eq(showings.id, visit.id));
    expect((await h.call('POST', path('complete'), { lat: 43.6532, lng: -79.3832, accuracyM: 10, platform: 'ios' }, agent)).body.code).toBe('too_far');
    expect((await h.call('POST', path('complete'), near, agent)).body.completed).toBe(true);
    expect((await h.call('GET', '/showings', undefined, b.t)).body.find((s: { id: string }) => s.id === visit.id).status).toBe('completed');

    // The agent's day and the broker of record's view read the same audit trail.
    const mine = (await h.call('GET', '/pro/activity', undefined, agent)).body;
    expect(mine.summary.visitsCompleted).toBeGreaterThanOrEqual(1);
    const ours = mine.events.filter((e: { showingId: string }) => e.showingId === visit.id).map((e: { action: string }) => e.action);
    expect(ours.filter((a: string) => !a.endsWith('_refused'))).toEqual(['showing_confirm', 'showing_check_in', 'showing_complete']);
    expect(ours.filter((a: string) => a.endsWith('_refused'))).toHaveLength(7);
    expect(mine.events.find((e: { showingId: string; reason: string }) => e.showingId === visit.id && e.reason === 'too_far')).toMatchObject({ address: '9 Fern Ln', clientName: 'Test Buyer', platform: 'ios' });
    expect((await h.call('GET', '/pro/activity?day=29-10-2026', undefined, agent)).body.code).toBe('bad_day');
    expect((await h.call('GET', '/admin/field-activity', undefined, agent)).body.code).toBe('not_staff');
    const broker = await staff('priya.nair@klyr.example');
    const all = (await h.call('GET', '/admin/field-activity', undefined, broker)).body;
    expect(all.agents.map((a: { name: string }) => a.name).sort()).toEqual(['Daniel Okafor', 'Maya Chen']);
    expect(all.agents.find((a: { agentId: string; summary: { visitsCompleted: number } }) => a.summary.visitsCompleted >= 1)).toBeTruthy();

    const refused = await db.select().from(auditLog).where(and(eq(auditLog.entityId, visit.id), like(auditLog.action, '%_refused')));
    expect(refused.map(r => (r.data as { reason: string }).reason).sort()).toEqual(['low_accuracy', 'mocked_location', 'not_phone', 'outside_window', 'too_far', 'too_far', 'too_soon']);
  });
});

describe('compliance review', () => {
  it('holds a politically exposed buyer until the compliance officer approves', async () => {
    const b = await readyBuyer({ ...ID, politicallyExposed: true });
    const listingId = (await h.call('GET', '/listings', undefined, b.t)).body.results[0].id;
    expect((await h.call('POST', '/showings', { listingId, at: inMin(24 * 60) }, b.t)).body.code).toBe('id_required');

    const officer = await staff('priya.nair@klyr.example');
    const item = (await h.call('GET', '/admin/id-reviews', undefined, officer)).body.find((r: { email: string }) => r.email === b.email);
    expect(item).toMatchObject({ politicallyExposed: true, occupation: 'Nurse', sourceOfFunds: ['savings'] });
    expect((await h.call('POST', `/admin/id-reviews/${item.id}`, { decision: 'approve', note: '' }, officer)).status).toBe(400);
    expect((await h.call('POST', `/admin/id-reviews/${item.id}`, { decision: 'approve', note: 'Former municipal councillor; funds from savings confirmed.' }, officer)).body.status).toBe('verified');
    expect((await h.call('POST', `/admin/id-reviews/${item.id}`, { decision: 'reject', note: 'again' }, officer)).body.code).toBe('already_reviewed');
    expect(h.outbox.filter(m => m.to === b.email).at(-1)!.subject).toBe('Your ID check is complete');
    expect((await h.call('POST', '/showings', { listingId, at: inMin(24 * 60) }, b.t)).status).toBe(201);
  });
});
