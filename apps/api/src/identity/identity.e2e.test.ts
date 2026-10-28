/**
 * End-to-end identity flows against a real Postgres (DATABASE_URL). Emails are captured in memory.
 */
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { totpAt, totpStep } from './crypto.js';
import { MAILER, type Mail } from './mailer.js';

const outbox: Mail[] = [];
let app: INestApplication, base = '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Json };
};
const lastCode = (to: string) => outbox.filter(m => m.to === to).at(-1)!.text.match(/\b(\d{6})\b/)![1]!;
const email = (tag: string) => `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
const signupBody = (e: string) => ({
  legalName: 'Alex Rivera', email: e, phone: '(416) 555-0182', plan: 'buyer',
  setup: { areas: ['Mississauga'], maxPrice: 1_100_000, firstTime: true },
  acceptTerms: true, acceptPrivacy: true, recoGuideRead: true,
});
async function signUpAndVerify(e = email('alex')) {
  expect((await call('POST', '/auth/signup', signupBody(e))).status).toBe(202);
  const r = await call('POST', '/auth/email/verify', { email: e, code: lastCode(e) });
  expect(r.status).toBe(200);
  return { email: e, token: r.body.session.token as string, user: r.body.user };
}

beforeAll(async () => {
  const { db, pool } = createDb();
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  await pool.end();
  (config.emailCode as { cooldownSeconds: number }).cooldownSeconds = 0;
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER).useValue({ send: async (m: Mail) => { outbox.push(m); } })
    .compile();
  app = mod.createNestApplication();
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', 'localhost');
});
afterAll(async () => { await app?.close(); });

describe('sign-up', () => {
  it('keeps listing data behind sign-in (VOW)', async () => {
    expect((await call('GET', '/listings')).status).toBe(401);
  });

  it('requires terms, privacy and RECO guide', async () => {
    const r = await call('POST', '/auth/signup', { ...signupBody(email('x')), acceptPrivacy: false });
    expect(r.status).toBe(400);
  });

  it('verifies email with a single-use code and signs in', async () => {
    const e = email('alex');
    await call('POST', '/auth/signup', signupBody(e));
    const code = lastCode(e);
    expect((await call('POST', '/auth/email/verify', { email: e, code: code === '000000' ? '111111' : '000000' })).status).toBe(401);
    const ok = await call('POST', '/auth/email/verify', { email: e, code });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ email: e, emailVerified: true, roles: ['buyer'], hasPassword: false });
    expect(ok.body.session.mfaRequired).toBe(false);
    expect((await call('POST', '/auth/email/verify', { email: e, code })).status).toBe(401); // reused
    expect((await call('GET', '/listings', undefined, ok.body.session.token)).status).toBe(200);
  });

  it('locks a code after 5 wrong tries', async () => {
    const e = email('brute');
    await call('POST', '/auth/signup', signupBody(e));
    const code = lastCode(e), wrong = code === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) await call('POST', '/auth/email/verify', { email: e, code: wrong });
    expect((await call('POST', '/auth/email/verify', { email: e, code })).status).toBe(401);
  });

  it('answers the same for an existing account and emails a sign-in code instead', async () => {
    const { email: e } = await signUpAndVerify();
    const r = await call('POST', '/auth/signup', signupBody(e));
    expect(r.status).toBe(202);
    expect(outbox.at(-1)!.text).toContain('already have a Klyr account');
  });
});

describe('passwords and two-factor', () => {
  it('signs in with a password and locks after 10 failures', async () => {
    const { email: e, token } = await signUpAndVerify();
    expect((await call('POST', '/auth/password', { password: 'short' }, token)).status).toBe(400);
    expect((await call('POST', '/auth/password', { password: 'a long enough passphrase' }, token)).status).toBe(200);
    expect((await call('POST', '/auth/password/login', { email: e, password: 'a long enough passphrase' })).status).toBe(200);
    for (let i = 0; i < 10; i++) await call('POST', '/auth/password/login', { email: e, password: 'wrong wrong wrong' });
    expect((await call('POST', '/auth/password/login', { email: e, password: 'a long enough passphrase' })).status).toBe(429);
  });

  it('needs a fresh second factor to change an existing password', async () => {
    const { token } = await signUpAndVerify();
    await call('POST', '/auth/password', { password: 'first passphrase here' }, token);
    const r = await call('POST', '/auth/password', { password: 'second passphrase here' }, token);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('step_up_required');
  });

  it('enrols TOTP, then holds new sign-ins until the code is entered', async () => {
    const { email: e, token } = await signUpAndVerify();
    await call('POST', '/auth/password', { password: 'a long enough passphrase' }, token);
    const setup = await call('POST', '/auth/mfa/totp/setup', undefined, token);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Klyr:/);
    const step = totpStep();
    expect((await call('POST', '/auth/mfa/totp/enable', { code: totpAt(setup.body.secret, step) }, token)).status).toBe(200);

    const login = await call('POST', '/auth/password/login', { email: e, password: 'a long enough passphrase' });
    expect(login.body.session.mfaRequired).toBe(true);
    const pending = login.body.session.token;
    const blocked = await call('GET', '/listings', undefined, pending);
    expect(blocked.status).toBe(401);
    expect(blocked.body.code).toBe('mfa_required');
    // The enrolment code can't be replayed; the next step's code is accepted.
    expect((await call('POST', '/auth/mfa/totp/verify', { code: totpAt(setup.body.secret, step) }, pending)).status).toBe(401);
    expect((await call('POST', '/auth/mfa/totp/verify', { code: totpAt(setup.body.secret, step + 1) }, pending)).status).toBe(200);
    expect((await call('GET', '/listings', undefined, pending)).status).toBe(200);
    // Step-up is now fresh, so the password can be changed.
    expect((await call('POST', '/auth/password', { password: 'a brand new passphrase' }, pending)).status).toBe(200);
  });
});

describe('sessions', () => {
  it('lists devices and signs one out', async () => {
    const { email: e, token } = await signUpAndVerify();
    await call('POST', '/auth/email/start', { email: e });
    const second = (await call('POST', '/auth/email/verify', { email: e, code: lastCode(e) })).body.session.token;
    const list = await call('GET', '/auth/sessions', undefined, token);
    expect(list.body).toHaveLength(2);
    const other = list.body.find((s: { current: boolean }) => !s.current);
    expect((await call('DELETE', `/auth/sessions/${other.id}`, undefined, token)).status).toBe(200);
    expect((await call('GET', '/auth/me', undefined, second)).status).toBe(401);
    expect((await call('POST', '/auth/logout', undefined, token)).status).toBe(200);
    expect((await call('GET', '/auth/me', undefined, token)).status).toBe(401);
  });

  it('issues passkey challenges', async () => {
    const { token } = await signUpAndVerify();
    const reg = await call('POST', '/auth/passkey/register/options', undefined, token);
    expect(reg.body.options.authenticatorSelection.residentKey).toBe('required');
    const login = await call('POST', '/auth/passkey/login/options');
    expect(login.body.challengeId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
