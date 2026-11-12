/** People for end-to-end tests: buyers ready to visit and offer, and staff signed in with their authenticator. */
import { inArray, like } from 'drizzle-orm';
import { expect } from 'vitest';
import type { Db } from '../db/db.module.js';
import { emailCodes, totpCredentials, users } from '../db/schema.js';
import { totpAt, totpStep } from '../identity/crypto.js';
import type { startApp } from './harness.js';

type App = Awaited<ReturnType<typeof startApp>>;
export const AGENT_EMAIL: Record<string, string> = { 'Maya Chen': 'maya.chen@klyr.example', 'Daniel Okafor': 'daniel.okafor@klyr.example' };
export const ID = { occupation: 'Nurse', sourceOfFunds: ['savings'], actingForThirdParty: false, politicallyExposed: false, buyingAs: 'self', vendorRef: 'sandbox' };
export const inMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

export function people(h: App) {
  const lastCode = (email: string) => h.outbox.filter(m => m.to === email).at(-1)!.text.match(/\b(\d{6})\b/)![1]!;
  const staffTokens = new Map<string, string>();

  /** A fresh "Confirm it's you" by email code, for signing. */
  async function stepUp(t: string, email: string) {
    await h.call('POST', '/auth/stepup/email/start', undefined, t);
    expect((await h.call('POST', '/auth/stepup/email/verify', { code: lastCode(email) }, t)).status).toBe(200);
  }

  return {
    lastCode,
    stepUp,
    /** Staff sign in once per run: an email code, then setting up TOTP (which counts as the second factor). */
    async staff(email: string) {
      if (staffTokens.has(email)) return staffTokens.get(email)!;
      await h.call('POST', '/auth/email/start', { email });
      const t = (await h.call('POST', '/auth/email/verify', { email, code: lastCode(email) })).body.session.token as string;
      const setup = (await h.call('POST', '/auth/mfa/totp/setup', undefined, t)).body;
      expect((await h.call('POST', '/auth/mfa/totp/enable', { code: totpAt(setup.secret, totpStep()) }, t)).status).toBe(200);
      staffTokens.set(email, t);
      return t;
    },
    /** A buyer ready to book and offer: Form 300 signed, ID checked. */
    async readyBuyer(id: Partial<typeof ID> = {}) {
      const t = await h.signedIn();
      const email = (await h.call('GET', '/auth/me', undefined, t)).body.email as string;
      await stepUp(t, email);
      expect((await h.call('POST', '/agreements/300/sign', { typedName: 'Test Buyer', readConfirmed: true }, t)).status).toBe(201);
      await h.call('POST', '/id-check', { ...ID, ...id }, t);
      const agent = (await h.call('GET', '/buying', undefined, t)).body.agent.name as string;
      return { t, email, agentEmail: AGENT_EMAIL[agent]! };
    },
  };
}

/** Seeded staff keep their authenticator and recent codes between runs; each test file starts them clean. */
export async function resetStaff(db: Db) {
  await db.delete(emailCodes).where(like(emailCodes.email, '%@klyr.example'));
  await db.delete(totpCredentials).where(inArray(totpCredentials.userId, db.select({ id: users.id }).from(users).where(like(users.email, '%@klyr.example'))));
}
