import { and, eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { auditLog, pushDevices, sessions, showings } from '../db/schema.js';
import { NotifyService } from '../notify/notify.service.js';
import { sendVisitReminders } from '../notify/visit-notes.js';
import { startApp } from '../test/harness.js';
import { AGENT_EMAIL, ID, inMin, people, resetStaff } from '../test/people.js';

let h: Awaited<ReturnType<typeof startApp>>;
const { db, pool } = createDb();
beforeAll(async () => {
  h = await startApp();
  p = people(h);
  await import('../db/seed.js');
  await resetStaff(db);
});
afterAll(async () => { await h?.app.close(); await pool.end(); });

let p: ReturnType<typeof people>;
const lastCode = (email: string) => p.lastCode(email);
const staff = (email: string) => p.staff(email);
const readyBuyer = (id: Partial<typeof ID> = {}) => p.readyBuyer(id);

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

describe('push to the agent’s phone', () => {
  it('tells the agent about new and cancelled visits, reminds before confirmed ones, and stops at sign-out', async () => {
    const b = await readyBuyer();
    const agent = await staff(b.agentEmail);
    const token = `ExponentPushToken[test-${Date.now()}]`;
    expect((await h.call('POST', '/pro/devices', { token: 'not-a-token', platform: 'ios' }, agent)).status).toBe(400);
    expect((await h.call('POST', '/pro/devices', { token, platform: 'ios' }, agent)).status).toBe(200);
    const mine = () => h.pushes.filter(p => p.to === token);

    const listingId = (await h.call('GET', '/listings', undefined, b.t)).body.results[1].id;
    const visit = (await h.call('POST', '/showings', { listingId, at: inMin(24 * 60) }, b.t)).body;
    expect(mine().at(-1)).toMatchObject({ title: 'New visit request', data: { screen: 'today', showingId: visit.id } });
    expect(mine().at(-1)!.body).not.toContain('Test Buyer'); // lock screens are public
    await h.call('DELETE', `/showings/${visit.id}`, undefined, b.t);
    expect(mine().at(-1)!.title).toBe('Visit cancelled by your client');

    // Reminder: once, about 45 minutes before a confirmed visit.
    const v2 = (await h.call('POST', '/showings', { listingId, at: inMin(25 * 60) }, b.t)).body;
    await h.call('POST', `/pro/showings/${v2.id}/decide`, { action: 'confirm' }, agent);
    await db.update(showings).set({ at: new Date(Date.now() + 40 * 60_000) }).where(eq(showings.id, v2.id));
    const notify = h.app.get(NotifyService);
    const sentBefore = mine().length;
    expect(await sendVisitReminders(db, notify)).toBeGreaterThanOrEqual(1); // other phones of this agent may count too
    expect(mine().length).toBe(sentBefore + 1);
    expect(mine().at(-1)!.title).toMatch(/^Visit at /);
    expect(mine().at(-1)!.body).toMatch(/Check in opens at .* within 150 m/);
    expect(await sendVisitReminders(db, notify)).toBe(0);

    // An uninstalled app is switched off; a signed-out session gets nothing.
    const before = mine().length;
    h.gone.add(token);
    await h.call('POST', '/showings', { listingId: (await h.call('GET', '/listings', undefined, b.t)).body.results[2].id, at: inMin(26 * 60) }, b.t);
    expect((await db.select().from(pushDevices).where(eq(pushDevices.token, token)))[0]!.disabledAt).not.toBeNull();
    h.gone.delete(token);
    expect((await h.call('POST', '/pro/devices', { token, platform: 'ios' }, agent)).status).toBe(200); // reinstalled
    const [device] = await db.select().from(pushDevices).where(eq(pushDevices.token, token));
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, device!.sessionId));
    await h.call('POST', '/showings', { listingId: (await h.call('GET', '/listings', undefined, b.t)).body.results[3].id, at: inMin(27 * 60) }, b.t);
    expect(mine().length).toBe(before);
  });
});
