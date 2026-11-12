import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { pushDevices, sessions } from '../db/schema.js';
import { PUSH, type Pusher } from './push.js';

export interface Note { title: string; body: string; data?: Record<string, string> }

/** Push to a person's phones. Never fails the action that triggered it: a lost push is logged, not thrown. */
@Injectable()
export class NotifyService {
  private readonly log = new Logger('Notify');
  constructor(@Inject(DB) private readonly db: Db, @Inject(PUSH) private readonly push: Pusher) {}

  /** Registers (or moves) a phone's token to this user and session. */
  async register(userId: string, sessionId: string, token: string, platform: 'ios' | 'android', app: 'agent' | 'consumer') {
    await this.db.insert(pushDevices).values({ userId, sessionId, token, platform, app })
      .onConflictDoUpdate({ target: pushDevices.token, set: { userId, sessionId, platform, app, disabledAt: null } });
  }

  /** Phones on a live session of this user, in the given app. */
  private async tokens(userId: string, app: 'agent' | 'consumer') {
    const rows = await this.db.select({ token: pushDevices.token }).from(pushDevices)
      .innerJoin(sessions, eq(sessions.id, pushDevices.sessionId))
      .where(and(eq(pushDevices.userId, userId), eq(pushDevices.app, app), isNull(pushDevices.disabledAt),
        isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(sessions.state, 'active')));
    return rows.map(r => r.token);
  }

  async toUser(userId: string, app: 'agent' | 'consumer', note: Note): Promise<number> {
    try {
      const tokens = await this.tokens(userId, app);
      if (!tokens.length) return 0;
      const results = await this.push.send(tokens.map(to => ({ to, ...note })));
      const gone = tokens.filter((_, i) => { const r = results[i]; return r && !r.ok && r.gone; });
      if (gone.length) await this.db.update(pushDevices).set({ disabledAt: new Date() }).where(inArray(pushDevices.token, gone));
      results.forEach(r => { if (!r.ok && !r.gone) this.log.warn(`push failed: ${r.error}`); });
      return results.filter(r => r.ok).length;
    } catch (e) {
      this.log.error(`push to ${userId} failed: ${e instanceof Error ? e.message : e}`);
      return 0;
    }
  }
}
