import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import { config } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { sessions } from '../db/schema.js';
import { newSessionToken, sha256 } from './crypto.js';

export interface ClientInfo { userAgent?: string; ip?: string }
export type Session = typeof sessions.$inferSelect;

const DAY = 86_400_000;

@Injectable()
export class SessionsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(userId: string, method: Session['method'], opts: { mfa: boolean; pending: boolean }, client: ClientInfo) {
    const token = newSessionToken(), now = new Date();
    const [row] = await this.db.insert(sessions).values({
      userId, method, tokenHash: sha256(token),
      state: opts.pending ? 'mfa_pending' : 'active',
      mfaAt: opts.mfa ? now : null,
      userAgent: client.userAgent?.slice(0, 300), ip: client.ip,
      expiresAt: new Date(now.getTime() + config.session.absoluteDays * DAY),
    }).returning();
    return { token, session: row! };
  }

  /** Resolves a bearer token; enforces absolute and idle expiry and touches last-seen. */
  async resolve(token: string): Promise<Session | null> {
    const now = new Date();
    const [row] = await this.db.select().from(sessions)
      .where(and(eq(sessions.tokenHash, sha256(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
    if (!row) return null;
    if (now.getTime() - row.lastSeenAt.getTime() > config.session.idleDays * DAY) {
      await this.revoke(row.id);
      return null;
    }
    if (now.getTime() - row.lastSeenAt.getTime() > 5 * 60_000) {
      await this.db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.id));
    }
    return row;
  }

  async completeMfa(id: string) {
    await this.db.update(sessions).set({ state: 'active', mfaAt: new Date() }).where(eq(sessions.id, id));
  }

  async revoke(id: string, userId?: string) {
    const where = userId ? and(eq(sessions.id, id), eq(sessions.userId, userId)) : eq(sessions.id, id);
    const r = await this.db.update(sessions).set({ revokedAt: new Date() }).where(and(where, isNull(sessions.revokedAt))).returning({ id: sessions.id });
    return r.length > 0;
  }

  /** "Sign out other devices". */
  async revokeOthers(userId: string, keepId: string) {
    const r = await this.db.update(sessions).set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), ne(sessions.id, keepId), isNull(sessions.revokedAt))).returning({ id: sessions.id });
    return r.length;
  }

  /** The device list on the Security screen. */
  list(userId: string) {
    return this.db.select({
      id: sessions.id, method: sessions.method, userAgent: sessions.userAgent, ip: sessions.ip,
      createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt,
    }).from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastSeenAt));
  }
}
