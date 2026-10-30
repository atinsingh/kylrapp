import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../config.js';
import { startApp } from '../test/harness.js';

let h: Awaited<ReturnType<typeof startApp>>;
let base: string;
beforeAll(async () => { h = await startApp(); config.rateLimit.scale = 1; base = (await h.app.getUrl()).replace('[::1]', 'localhost'); });
afterAll(async () => { await h?.app.close(); });

describe('request limits and headers', () => {
  it('slows down guessing on sign-in, per address', async () => {
    const tries = [];
    for (let i = 0; i < 21; i++) tries.push(await fetch(base + '/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' }, body: JSON.stringify({ email: 'nobody@example.com', code: '000000' }) }));
    expect(tries.slice(0, 20).every(r => r.status !== 429)).toBe(true);
    expect(tries[20]!.status).toBe(429);
    expect(Number(tries[20]!.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await tries[20]!.json()).code).toBe('rate_limited');
    // Another address is counted on its own (the load balancer's X-Forwarded-For is trusted for one hop).
    const other = await fetch(base + '/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8' }, body: JSON.stringify({ email: 'nobody@example.com', code: '000000' }) });
    expect(other.status).not.toBe(429);
  });

  it('limits a partner API key on its own', async () => {
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await fetch(base + '/partner/api/requests', { headers: { authorization: 'Bearer klyr_pk_notarealkey' } })).status;
    expect(last).toBe(429);
    expect((await fetch(base + '/partner/api/requests', { headers: { authorization: 'Bearer klyr_pk_anotherkey' } })).status).toBe(401);
  });

  it('sends security headers and never caches API answers', async () => {
    const r = await fetch(base + '/health');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options')).toBe('DENY');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(r.headers.get('x-powered-by')).toBeNull();
  });
});
