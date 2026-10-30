import { desc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { deals, publishedSettings } from '../db/schema.js';
import { startApp } from '../test/harness.js';
import { people, resetStaff } from '../test/people.js';

let h: Awaited<ReturnType<typeof startApp>>;
let p: ReturnType<typeof people>;
const { db, pool } = createDb();
const published: string[] = [];
beforeAll(async () => { h = await startApp(); p = people(h); await import('../db/seed.js'); await resetStaff(db); });
afterAll(async () => { if (published.length) await db.delete(publishedSettings).where(inArray(publishedSettings.id, published)); await h?.app.close(); await pool.end(); });
const OFFICER = 'priya.nair@klyr.example';
const mail = (to: string) => h.outbox.filter(m => m.to === to).at(-1)!;

describe('Klyr Admin modules', () => {
  it('listings feed: status, checks, and suspending a listing hides it from clients', async () => {
    const admin = await p.staff(OFFICER), client = await h.signedIn();
    expect((await h.call('GET', '/admin/listings-feed', undefined, client)).status).toBe(403);
    const s = (await h.call('GET', '/admin/listings-feed', undefined, admin)).body;
    expect(s.feed.connected).toBe(false);
    expect(s.checks.every((c: { ok: boolean }) => c.ok)).toBe(true);
    const one = (await h.call('GET', '/listings', undefined, client)).body.results[0];
    expect((await h.call('POST', `/admin/listings-feed/${one.id}/suspend`, { reason: 'x' }, admin)).status).toBe(400);
    await h.call('POST', `/admin/listings-feed/${one.id}/suspend`, { reason: 'Seller asked to pause showings' }, admin);
    expect((await h.call('GET', '/listings', undefined, client)).body.results.some((l: { id: string }) => l.id === one.id)).toBe(false);
    await h.call('POST', `/admin/listings-feed/${one.id}/restore`, undefined, admin);
    expect((await h.call('GET', '/listings', undefined, client)).body.results.some((l: { id: string }) => l.id === one.id)).toBe(true);
  });

  it('privacy: access gives a copy, deletion closes the account and keeps legal records', async () => {
    const admin = await p.staff(OFFICER), t = await h.signedIn();
    const email = (await h.call('GET', '/auth/me', undefined, t)).body.email as string;
    const [access] = (await h.call('POST', '/me/privacy-requests', { kind: 'access' }, t)).body;
    expect(access).toMatchObject({ kind: 'access', status: 'open' });
    expect(mail(email).subject).toBe('We received your privacy request');
    expect((await h.call('POST', '/me/privacy-requests', { kind: 'access' }, t)).body.code).toBe('request_open');
    expect((await h.call('POST', '/me/privacy-requests', { kind: 'correction' }, t)).status).toBe(400);
    expect((await h.call('GET', `/me/privacy-requests/${access.id}/export`, undefined, t)).status).toBe(404);
    const queue = (await h.call('GET', '/admin/privacy', undefined, admin)).body;
    expect(queue.find((q: { id: string }) => q.id === access.id)).toMatchObject({ email, overdue: false });
    await h.call('POST', `/admin/privacy/${access.id}`, { result: 'completed', response: 'Here is everything we hold about you.' }, admin);
    const copy = (await h.call('GET', `/me/privacy-requests/${access.id}/export`, undefined, t)).body;
    expect(copy.account.email).toBe(email);
    expect(Array.isArray(copy.activity)).toBe(true);

    const del = (await h.call('POST', '/me/privacy-requests', { kind: 'deletion' }, t)).body.find((r: { kind: string }) => r.kind === 'deletion');
    await h.call('POST', `/admin/privacy/${del.id}`, { result: 'completed', response: 'Your account is closed.' }, admin);
    expect(mail(email).subject).toBe('Your Klyr account is deleted');
    expect((await h.call('GET', '/auth/me', undefined, t)).status).toBe(401);

    // Someone with an open deal waits: deletion can't complete yet.
    const b = await p.readyBuyer();
    const d2 = (await h.call('POST', '/me/privacy-requests', { kind: 'deletion' }, b.t)).body[0];
    expect((await h.call('POST', `/admin/privacy/${d2.id}`, { result: 'completed', response: 'Closing it.' }, admin)).body.code).toBe('open_deal');
  });

  it('assumptions: a published version becomes every new client’s default', async () => {
    const admin = await p.staff(OFFICER);
    const before = (await h.call('GET', '/admin/assumptions', undefined, admin)).body.current;
    const out = (await h.call('POST', '/admin/assumptions', { rate: 0.0399, downPct: 0.2, lawyerFee: 1900, note: 'Five-year fixed fell; lawyer fees rose.' }, admin)).body;
    published.push(out.history[0].id);
    expect(out.current).toMatchObject({ rate: 0.0399, lawyerFee: 1900, overdue: false });
    expect(out.history[0]).toMatchObject({ note: 'Five-year fixed fell; lawyer fees rose.', by: 'Priya Nair' });
    const t = await h.signedIn();
    expect((await h.call('GET', '/me/assumptions', undefined, t)).body).toMatchObject({ rate: 0.0399, lawyerFee: 1900, custom: false });
    expect(before.rate).not.toBe(0.0399);
  });

  it('users and roles: agents need RECO details, and the brokerage keeps a broker of record', async () => {
    const admin = await p.staff(OFFICER), t = await h.signedIn();
    const email = (await h.call('GET', '/auth/me', undefined, t)).body.email as string;
    expect((await h.call('POST', '/admin/users/roles', { email, role: 'agent', action: 'grant' }, admin)).body.code).toBe('reco_required');
    const staff = (await h.call('POST', '/admin/users/roles', { email, role: 'agent', action: 'grant', registeredName: 'Sam Lee', title: 'Salesperson', recoNumber: 'SAMPLE-0099' }, admin)).body;
    expect(staff.find((s: { email: string }) => s.email === email)).toMatchObject({ roles: ['agent'], agent: { recoNumber: 'SAMPLE-0099', openDeals: 0 }, mfa: { authenticator: false } });
    expect(staff.find((s: { email: string }) => s.email === OFFICER).mfa.authenticator).toBe(true);
    const after = (await h.call('POST', '/admin/users/roles', { email, role: 'agent', action: 'revoke' }, admin)).body;
    expect(after.some((s: { email: string }) => s.email === email)).toBe(false);
    expect((await h.call('POST', '/admin/users/roles', { email: OFFICER, role: 'broker_of_record', action: 'revoke' }, admin)).body.code).toBe('own_role');
    const audit = (await h.call('GET', '/admin/users/audit', undefined, admin)).body;
    expect(audit.slice(0, 5).map((a: { action: string }) => a.action)).toContain('role_revoke');
  });

  it('reassigns an agent’s open deals so the agent can be removed, and tells each client', async () => {
    const admin = await p.staff(OFFICER);
    // The buyer first, so their deal goes to a seeded agent; then two new agents.
    const b = await p.readyBuyer();
    const agentUser = async (name: string, reco: string) => {
      const t = await h.signedIn();
      const email = (await h.call('GET', '/auth/me', undefined, t)).body.email as string;
      await h.call('POST', '/admin/users/roles', { email, role: 'agent', action: 'grant', registeredName: name, title: 'Salesperson', recoNumber: reco }, admin);
      return email;
    };
    const sam = await agentUser('Sam Lee', 'SAMPLE-0201'), jo = await agentUser('Jo Park', 'SAMPLE-0202');
    const staff = (await h.call('GET', '/admin/users', undefined, admin)).body as { id: string; email: string }[];
    const samId = staff.find(s => s.email === sam)!.id, joId = staff.find(s => s.email === jo)!.id, originalAgent = staff.find(s => s.email === b.agentEmail)!.id;
    const [deal] = await db.select().from(deals).where(eq(deals.agentId, originalAgent)).orderBy(desc(deals.createdAt)).limit(1);
    await db.update(deals).set({ agentId: samId }).where(eq(deals.id, deal!.id));

    expect((await h.call('POST', '/admin/users/roles', { email: sam, role: 'agent', action: 'revoke' }, admin)).body.code).toBe('open_deals');
    expect((await h.call('POST', '/admin/users/reassign', { fromEmail: sam, toEmail: b.email }, admin)).body.code).toBe('not_agent');
    expect((await h.call('POST', '/admin/users/reassign', { fromEmail: sam, toEmail: sam }, admin)).status).toBe(400);
    expect((await h.call('POST', '/admin/users/reassign', { fromEmail: sam, toEmail: jo }, admin)).body.moved).toBe(1);
    expect((await db.select().from(deals).where(eq(deals.id, deal!.id)))[0]!.agentId).toBe(joId);
    expect(mail(b.email).subject).toBe('Your Klyr agent has changed');
    expect(mail(b.email).text).toMatch(/Jo Park, Salesperson, is now your agent/);
    expect((await h.call('POST', '/admin/users/reassign', { fromEmail: sam, toEmail: jo }, admin)).body.code).toBe('no_open_deals');
    expect((await h.call('POST', '/admin/users/roles', { email: sam, role: 'agent', action: 'revoke' }, admin)).status).toBe(200);
    // Put things back so later test files assign deals to the seeded agents only.
    await db.update(deals).set({ agentId: originalAgent }).where(eq(deals.agentId, joId));
    await h.call('POST', '/admin/users/roles', { email: jo, role: 'agent', action: 'revoke' }, admin);
  });
});
