import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { torontoInstant, torontoToday } from '@klyr/core';
import { createDb } from '../db/client.js';
import { listings, savedSearches } from '../db/schema.js';
import { MAILER } from '../identity/mailer.js';
import { NotifyService } from '../notify/notify.service.js';
import { startApp } from '../test/harness.js';
import { sendSearchAlerts } from './alerts.js';

let h: Awaited<ReturnType<typeof startApp>>;
const { db, pool } = createDb();
const cleanup: (() => Promise<unknown>)[] = [];
beforeAll(async () => { h = await startApp(); await import('../db/seed.js'); });
afterAll(async () => { for (const c of cleanup.reverse()) await c(); await h?.app.close(); await pool.end(); });

const run = (now = new Date()) => sendSearchAlerts({ db, notify: h.app.get(NotifyService), mail: h.app.get(MAILER) }, now);

describe('saved searches', () => {
  it('saves a search, then alerts once for a price drop and a new listing, with no prices in the push', async () => {
    const t = await h.signedIn();
    const email = (await h.call('GET', '/auth/me', undefined, t)).body.email;
    const phone = `ExponentPushToken[search-${Date.now()}]`;
    await h.call('POST', '/me/devices', { token: phone, platform: 'android' }, t);
    const homes = (await h.call('GET', '/listings?city=Oakville,Mississauga&maxPrice=1200000', undefined, t)).body.results;
    expect(homes.length).toBeGreaterThan(0);

    expect((await h.call('POST', '/me/searches', { name: '', filters: {}, alert: 'instant' }, t)).status).toBe(400);
    const saved = (await h.call('POST', '/me/searches', { name: 'West GTA under $1.2M', filters: { city: 'Oakville,Mississauga', maxPrice: 1_200_000 }, alert: 'instant' }, t)).body;
    expect(saved.matches).toBe(homes.length);
    expect((await h.call('GET', '/me/searches', undefined, t)).body[0]).toMatchObject({ name: 'West GTA under $1.2M', alert: 'instant', matches: homes.length });

    // Nothing has changed since saving.
    await run();
    expect(h.outbox.filter(m => m.to === email)).toHaveLength(1); // just the sign-up code

    // A price drop and a new listing.
    const [home] = homes;
    await db.update(listings).set({ price: home.price - 25_000 }).where(eq(listings.id, home.id));
    cleanup.push(() => db.update(listings).set({ price: home.price }).where(eq(listings.id, home.id)));
    const [row] = await db.select().from(listings).where(eq(listings.id, home.id));
    const { id: _id, ...copy } = row!;
    const [fresh] = await db.insert(listings).values({ ...copy, mlsNumber: `TEST${Date.now()}`, address: '77 Test Gate', price: 999_000, listedAt: new Date().toISOString().slice(0, 10) }).returning();
    cleanup.push(() => db.delete(listings).where(eq(listings.id, fresh!.id)));

    await run();
    const alert = h.outbox.filter(m => m.to === email).at(-1)!;
    expect(alert.subject).toBe('West GTA under $1.2M: 1 new, 1 price drop');
    expect(alert.text).toContain('New: 77 Test Gate');
    expect(alert.text).toMatch(new RegExp(`Price drop: ${home.address}.* \\(was \\$${home.price.toLocaleString('en-CA')}\\)`));
    expect(h.pushes.filter(p => p.to === phone).at(-1)).toMatchObject({ title: 'West GTA under $1.2M', body: '1 new, 1 price drop', data: { screen: 'searches' } });

    // Told once.
    await run();
    expect(h.outbox.filter(m => m.to === email).at(-1)).toBe(alert);
  });

  it('sends daily digests once a morning, and can be turned off or deleted', async () => {
    const t = await h.signedIn();
    const email = (await h.call('GET', '/auth/me', undefined, t)).body.email;
    const s = (await h.call('POST', '/me/searches', { name: 'Condos', filters: { type: 'Condo' }, alert: 'daily' }, t)).body;
    const [cheap] = (await h.call('GET', '/listings?type=Condo', undefined, t)).body.results;
    await db.update(listings).set({ price: cheap.price - 10_000 }).where(eq(listings.id, cheap.id));
    cleanup.push(() => db.update(listings).set({ price: cheap.price }).where(eq(listings.id, cheap.id)));

    const [y, m, d] = torontoToday();
    await run(torontoInstant(y, m, d, 6, 30)); // before 7 am: not yet
    expect(h.outbox.filter(x => x.to === email)).toHaveLength(1);
    await run(torontoInstant(y, m, d, 7, 5));
    expect(h.outbox.filter(x => x.to === email).at(-1)!.subject).toBe('Condos: 1 price drop');
    await db.update(listings).set({ price: cheap.price - 20_000 }).where(eq(listings.id, cheap.id));
    await run(torontoInstant(y, m, d, 9, 0)); // already sent this morning
    expect(h.outbox.filter(x => x.to === email)).toHaveLength(2);

    expect((await h.call('PATCH', `/me/searches/${s.id}`, { alert: 'off' }, t)).body.alert).toBe('off');
    expect((await h.call('DELETE', `/me/searches/${s.id}`, undefined, t)).status).toBe(200);
    expect((await h.call('GET', '/me/searches', undefined, t)).body).toEqual([]);
    const other = await h.signedIn();
    expect((await h.call('DELETE', `/me/searches/${s.id}`, undefined, other)).status).toBe(404);
    for (let i = 0; i < 10; i++) await h.call('POST', '/me/searches', { name: `S${i}`, filters: {}, alert: 'off' }, other);
    expect((await h.call('POST', '/me/searches', { name: 'one more', filters: {}, alert: 'off' }, other)).body.code).toBe('too_many');
    await db.delete(savedSearches).where(eq(savedSearches.alert, 'off'));
  });
});
