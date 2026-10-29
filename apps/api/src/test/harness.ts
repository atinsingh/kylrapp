/** Boots the real app against DATABASE_URL with an in-memory mailbox, for end-to-end tests. */
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { AppModule } from '../app.module.js';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { MAILER, type Mail } from '../identity/mailer.js';
import { PUSH, type PushMessage } from '../notify/push.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export async function startApp() {
  const { db, pool } = createDb();
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  await pool.end();
  (config.emailCode as { cooldownSeconds: number }).cooldownSeconds = 0;

  const outbox: Mail[] = [];
  /** Pushes sent; tokens in `gone` answer as uninstalled. */
  const pushes: PushMessage[] = [];
  const gone = new Set<string>();
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER).useValue({ send: async (m: Mail) => { outbox.push(m); } })
    .overrideProvider(PUSH).useValue({
      send: async (ms: PushMessage[]) => ms.map(m => (gone.has(m.to) ? { ok: false, gone: true, error: 'DeviceNotRegistered' } : (pushes.push(m), { ok: true }))),
    })
    .compile();
  const app: INestApplication = mod.createNestApplication();
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', 'localhost');

  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as Json };
  };

  /** A new, verified buyer; returns their bearer token. */
  async function signedIn(): Promise<string> {
    const email = `t.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
    await call('POST', '/auth/signup', { legalName: 'Test Buyer', email, plan: 'buyer', acceptTerms: true, acceptPrivacy: true, recoGuideRead: true });
    const code = outbox.filter(m => m.to === email).at(-1)!.text.match(/\b(\d{6})\b/)![1];
    return (await call('POST', '/auth/email/verify', { email, code })).body.session.token;
  }

  return { app, call, signedIn, outbox, pushes, gone };
}
