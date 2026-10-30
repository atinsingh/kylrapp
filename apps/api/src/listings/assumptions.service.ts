import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DEFAULT_ASSUMPTIONS } from '@klyr/core';
import type { Assumptions } from '@klyr/contracts';
import { DB, type Db } from '../db/db.module.js';
import { buyerAssumptions, moveProfiles, publishedSettings } from '../db/schema.js';

/** The estimate defaults in force: the newest version Klyr Admin published, else the values shipped in `@klyr/core`. */
export async function publishedAssumptions(db: Db) {
  const [row] = await db.select().from(publishedSettings).where(eq(publishedSettings.key, 'assumptions')).orderBy(desc(publishedSettings.publishedAt)).limit(1);
  const v = (row?.value ?? {}) as { rate?: number; downPct?: number; lawyerFee?: number };
  return {
    rate: v.rate ?? DEFAULT_ASSUMPTIONS.rate, downPct: v.downPct ?? DEFAULT_ASSUMPTIONS.downPct, lawyerFee: v.lawyerFee ?? DEFAULT_ASSUMPTIONS.lawyerFee,
    asOf: row ? row.publishedAt.toISOString().slice(0, 10) : DEFAULT_ASSUMPTIONS.asOf, note: row?.note ?? 'Shipped defaults', version: row?.id ?? null,
  };
}

/** A buyer's "How we estimate" inputs; defaults until they change them. */
@Injectable()
export class AssumptionsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async get(userId: string): Promise<Assumptions & { custom: boolean; asOf: string }> {
    // "Estimate as of" is the date the published defaults were last reviewed, on every screen.
    const [[row], pub] = await Promise.all([this.db.select().from(buyerAssumptions).where(eq(buyerAssumptions.userId, userId)), publishedAssumptions(this.db)]);
    if (row) return { rate: row.rate, downPct: row.downPct, firstTime: row.firstTime, lawyerFee: row.lawyerFee, custom: true, asOf: pub.asOf };
    return { ...(await this.defaults(userId)), custom: false, asOf: pub.asOf };
  }

  async put(userId: string, a: Assumptions) {
    await this.db.insert(buyerAssumptions).values({ userId, ...a })
      .onConflictDoUpdate({ target: buyerAssumptions.userId, set: { ...a, updatedAt: new Date() } });
    return this.get(userId);
  }

  async reset(userId: string) {
    await this.db.delete(buyerAssumptions).where(eq(buyerAssumptions.userId, userId));
    return this.get(userId);
  }

  /** Published defaults, with first-time status taken from what they said at sign-up. */
  private async defaults(userId: string): Promise<Assumptions> {
    const profiles = await this.db.select({ data: moveProfiles.data }).from(moveProfiles)
      .where(and(eq(moveProfiles.userId, userId)));
    const said = profiles.map(p => (p.data as { firstTime?: unknown }).firstTime).find(v => typeof v === 'boolean');
    const pub = await publishedAssumptions(this.db);
    return { rate: pub.rate, downPct: pub.downPct, firstTime: said ?? true, lawyerFee: pub.lawyerFee };
  }
}

/** Maps stored assumptions onto the cost engine's options. */
export const engineOptions = (a: Assumptions) => ({ rate: a.rate, downPct: a.downPct, firstTime: a.firstTime, lawyer: a.lawyerFee });
