import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DEFAULT_ASSUMPTIONS } from '@klyr/core';
import type { Assumptions } from '@klyr/contracts';
import { DB, type Db } from '../db/db.module.js';
import { buyerAssumptions, moveProfiles } from '../db/schema.js';

/** A buyer's "How we estimate" inputs; defaults until they change them. */
@Injectable()
export class AssumptionsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async get(userId: string): Promise<Assumptions & { custom: boolean }> {
    const [row] = await this.db.select().from(buyerAssumptions).where(eq(buyerAssumptions.userId, userId));
    if (row) return { rate: row.rate, downPct: row.downPct, firstTime: row.firstTime, lawyerFee: row.lawyerFee, custom: true };
    return { ...(await this.defaults(userId)), custom: false };
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
    return {
      rate: DEFAULT_ASSUMPTIONS.rate,
      downPct: DEFAULT_ASSUMPTIONS.downPct,
      firstTime: said ?? true,
      lawyerFee: DEFAULT_ASSUMPTIONS.lawyerFee,
    };
  }
}

/** Maps stored assumptions onto the cost engine's options. */
export const engineOptions = (a: Assumptions) => ({ rate: a.rate, downPct: a.downPct, firstTime: a.firstTime, lawyer: a.lawyerFee });
