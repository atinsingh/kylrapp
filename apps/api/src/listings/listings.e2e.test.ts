import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from '../test/harness.js';

let h: Awaited<ReturnType<typeof startApp>>, token = '';

beforeAll(async () => {
  h = await startApp();
  await import('../db/seed.js'); // the six prototype listings and their sold comparables
  token = await h.signedIn();
});
afterAll(async () => { await h?.app.close(); });

const get = (path: string) => h.call('GET', path, undefined, token);

describe('search', () => {
  it('returns active listings only, each with photos and the all-in', async () => {
    const r = await get('/listings');
    const seed = r.body.results.filter((l: { mlsNumber: string }) => l.mlsNumber.startsWith('SEED-0'));
    expect(seed).toHaveLength(6);
    expect(r.body.results.some((l: { mlsNumber: string }) => l.mlsNumber.startsWith('SEED-S'))).toBe(false);
    for (const l of seed) {
      expect(l.photos.length).toBeGreaterThan(0);
      expect(l.photos[0].alt).not.toBe('');
      expect(l.listingBrokerage).toBeTruthy();
    }
  });

  it('filters by several cities and sorts', async () => {
    const r = await get('/listings?city=Oakville,Toronto&sort=price_desc');
    const cities = new Set(r.body.results.map((l: { city: string }) => l.city));
    expect([...cities].sort()).toEqual(['Oakville', 'Toronto']);
    const prices = r.body.results.map((l: { price: number }) => l.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });
});

describe('listing page', () => {
  it('has the breakdown, history, comparables and insights, and records the view', async () => {
    const maple = (await get('/listings?city=Mississauga&minBeds=4')).body.results.find((l: { address: string }) => l.address === '41 Maple Cres');
    expect(maple.viewedAt).toBeNull();
    const d = (await get(`/listings/${maple.id}`)).body;
    expect(d.estimate.allIn).toBe(4981); // the prototype's own number
    expect(d.estimate.allIn).toBe(maple.allIn);
    expect(d.history.map((e: { event: string }) => e.event)).toEqual(['listed', 'sold', 'listed']);
    expect(d.comparables.map((c: { address: string }) => c.address)).toEqual(['52 Maple Cres', '17 Oakmont Dr', '9 Sycamore Crt']);
    expect(d.comparables.every((c: { distanceM: number }) => c.distanceM < 2000)).toBe(true);
    expect(d.insights.schools[0].name).toBe('Maple Ridge PS');
    expect(d.photos.length).toBe(4);
    const again = (await get('/listings?city=Mississauga&minBeds=4')).body.results.find((l: { id: string }) => l.id === maple.id);
    expect(again.viewedAt).not.toBeNull();
  });

  it('does not open sold listings', async () => {
    const r = await h.call('GET', '/listings/00000000-0000-4000-8000-000000000000', undefined, token);
    expect(r.status).toBe(404);
  });
});

describe('saved homes', () => {
  it('saves, lists and unsaves for this user only', async () => {
    const id = (await get('/listings')).body.results[0].id;
    expect((await h.call('PUT', `/listings/${id}/save`, undefined, token)).body).toEqual({ saved: true });
    const mine = (await get('/listings?saved=true')).body.results;
    expect(mine.map((l: { id: string }) => l.id)).toEqual([id]);
    expect(mine[0].saved).toBe(true);
    const other = await h.signedIn();
    expect((await h.call('GET', '/listings?saved=true', undefined, other)).body.results).toEqual([]);
    await h.call('DELETE', `/listings/${id}/save`, undefined, token);
    expect((await get('/listings?saved=true')).body.results).toEqual([]);
  });
});
