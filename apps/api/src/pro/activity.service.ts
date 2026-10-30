import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, like, lt, or, sql } from 'drizzle-orm';
import { torontoInstant, torontoToday } from '@klyr/core';
import { DB, type Db } from '../db/db.module.js';
import { agents, auditLog, dealParties, deals, listings, showings, userRoles, users } from '../db/schema.js';

/** What an agent did in the field, read back from the audit log (the record of truth, never edited). */
const ACTIONS = ['showing_confirm', 'showing_move', 'showing_decline', 'showing_check_in', 'showing_complete'];
const address = sql<string>`case when ${listings.unit} is null then ${listings.address} else ${listings.address} || ' #' || ${listings.unit} end`;

export interface FieldEvent {
  at: string; action: string; showingId: string; address: string; clientName: string | null;
  reason: string | null; distanceM: number | null; accuracyM: number | null; platform: string | null; note: string | null;
}
export interface FieldDay {
  agentId: string; name: string;
  summary: { visitsCompleted: number; minutesOnSite: number; checkIns: number; refused: number; decisions: number };
  events: FieldEvent[];
}

@Injectable()
export class FieldActivityService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** A Toronto calendar day, "YYYY-MM-DD", as [start, end). Today by default. */
  bounds(day?: string): [Date, Date, string] {
    let ymd = torontoToday();
    if (day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException({ code: 'bad_day', message: 'Use a date like 2026-10-29.' });
      ymd = day.split('-').map(Number) as [number, number, number];
    }
    const [y, m, d] = ymd;
    return [torontoInstant(y, m, d, 0), torontoInstant(y, m, d + 1, 0), `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`];
  }

  /** One day for each agent (all agents when agentId is omitted), with the summary the broker of record reads. */
  async days(day: string | undefined, agentId?: string): Promise<{ day: string; agents: FieldDay[] }> {
    const [from, to, label] = this.bounds(day);
    const client = sql<string | null>`(select ${users.legalName} from ${dealParties} join ${users} on ${users.id} = ${dealParties.userId}
      where ${dealParties.dealId} = ${deals.id} and ${dealParties.role} = 'client' limit 1)`;
    const rows = await this.db.select({
      at: auditLog.at, action: auditLog.action, actorId: auditLog.actorId, data: auditLog.data,
      showingId: showings.id, address, clientName: client,
    }).from(auditLog)
      .innerJoin(showings, sql`${showings.id}::text = ${auditLog.entityId}`)
      .innerJoin(listings, eq(listings.id, showings.listingId))
      .innerJoin(deals, eq(deals.id, showings.dealId))
      .where(and(
        eq(auditLog.entity, 'showing'), gte(auditLog.at, from), lt(auditLog.at, to),
        or(inArray(auditLog.action, ACTIONS), like(auditLog.action, '%_refused')),
        agentId ? eq(auditLog.actorId, agentId) : undefined,
      ))
      .orderBy(asc(auditLog.at));

    // Current agents only: someone whose agent role was removed keeps their registration row, not a place here.
    const people = await this.db.select({ id: agents.userId, name: agents.registeredName }).from(agents)
      .innerJoin(userRoles, and(eq(userRoles.userId, agents.userId), eq(userRoles.role, 'agent')))
      .where(agentId ? eq(agents.userId, agentId) : undefined);
    return {
      day: label,
      agents: people.map(p => {
        const mine = rows.filter(r => r.actorId === p.id);
        const events: FieldEvent[] = mine.map(r => {
          const d = (r.data ?? {}) as Record<string, unknown>;
          const num = (k: string) => (typeof d[k] === 'number' ? Math.round(d[k] as number) : null);
          return {
            at: r.at.toISOString(), action: r.action, showingId: r.showingId, address: r.address, clientName: r.clientName,
            reason: typeof d.reason === 'string' ? d.reason : null, distanceM: num('distanceM'), accuracyM: num('accuracyM'),
            platform: typeof d.platform === 'string' ? d.platform : null, note: typeof d.note === 'string' ? d.note : null,
          };
        });
        // Time on site: from each check-in to the completion of the same visit.
        let minutesOnSite = 0;
        for (const done of events.filter(e => e.action === 'showing_complete')) {
          const start = events.find(e => e.action === 'showing_check_in' && e.showingId === done.showingId);
          if (start) minutesOnSite += Math.round((Date.parse(done.at) - Date.parse(start.at)) / 60_000);
        }
        return {
          agentId: p.id, name: p.name, events,
          summary: {
            visitsCompleted: events.filter(e => e.action === 'showing_complete').length,
            checkIns: events.filter(e => e.action === 'showing_check_in').length,
            minutesOnSite,
            refused: events.filter(e => e.action.endsWith('_refused')).length,
            decisions: events.filter(e => /^showing_(confirm|move|decline)$/.test(e.action)).length,
          },
        };
      }),
    };
  }
}
