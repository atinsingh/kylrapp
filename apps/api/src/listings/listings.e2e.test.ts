import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buyerEstimate } from '@klyr/core';
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

describe('how we estimate', () => {
  it('uses the buyer’s own inputs for every all-in, and only theirs', async () => {
    const me = await h.signedIn(), other = await h.signedIn();
    const mine = (path: string) => h.call('GET', path, undefined, me);
    const defaults = (await mine('/me/assumptions')).body;
    expect(defaults).toMatchObject({ rate: 0.0449, downPct: 0.2, firstTime: true, lawyerFee: 1850, custom: false });

    const maple = (await mine('/listings?city=Mississauga&minBeds=4')).body.results[0];
    expect(maple.allIn).toBe(4981);
    // Not a first-time buyer, cheaper lawyer: no $4,000 refund, $450 + HST less on the lawyer.
    const put = await h.call('PUT', '/me/assumptions', { rate: 0.0399, downPct: 0.05, firstTime: false, lawyerFee: 1400 }, me);
    expect(put.body.custom).toBe(true);
    const after = (await mine('/listings?city=Mississauga&minBeds=4')).body.results[0];
    const expected = buyerEstimate({ price: 1_150_000, city: 'Mississauga', type: 'House', coop: 0.022, tax: 6960 }, { rate: 0.0399, downPct: 0.05, firstTime: false, lawyer: 1400 });
    expect(after.allIn).toBe(expected.allIn);
    expect(after.allIn).not.toBe(4981);
    const d = (await mine(`/listings/${maple.id}`)).body;
    expect(d.estimate.allIn).toBe(after.allIn);
    expect(d.estimate.ltt.onR).toBe(0);
    expect(d.estimate.lawyer).toBe(Math.round(1400 * 1.13) + 450);
    // 5% is below the legal minimum at $1.15M ($25k + 10% over $500k), so it is raised.
    expect(d.estimate.downRaised).toBe(true);
    expect(d.estimate.down).toBe(90_000);
    expect(d.estimate.cmhc).toBeGreaterThan(0);
    expect(d.estimate.customAssumptions).toBe(true);

    const theirs = (await h.call('GET', '/listings?city=Mississauga&minBeds=4', undefined, other)).body.results[0];
    expect(theirs.allIn).toBe(4981);

    expect((await h.call('PUT', '/me/assumptions', { rate: 2, downPct: 0.2, firstTime: true, lawyerFee: 1850 }, me)).status).toBe(400);
    expect((await h.call('DELETE', '/me/assumptions', undefined, me)).body.custom).toBe(false);
    expect((await mine('/listings?city=Mississauga&minBeds=4')).body.results[0].allIn).toBe(4981);
  });

  it('fetches specific homes for Compare', async () => {
    const all = (await get('/listings')).body.results.slice(0, 2).map((l: { id: string }) => l.id);
    const r = (await get(`/listings?ids=${all.join(',')}`)).body.results;
    expect(r.map((l: { id: string }) => l.id).sort()).toEqual([...all].sort());
    expect(r[0]).toHaveProperty('landTransfer');
    expect(r[0]).toHaveProperty('monthlyTotal');
  });
});
