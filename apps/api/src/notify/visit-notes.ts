import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { GEOFENCE } from '@klyr/contracts';
import { TORONTO, torontoTime, torontoWhen } from '@klyr/core';
import type { Db } from '../db/db.module.js';
import { deals, listings, showings } from '../db/schema.js';
import type { Note, NotifyService } from './notify.service.js';

/** What an agent's phone shows. Only the home and the time: lock screens are public. */
const when = (d: Date) => torontoWhen(d);
const time = (d: Date) => torontoTime(d);

export const visitNotes = {
  requested: (address: string, at: Date, id: string): Note => ({ title: 'New visit request', body: `${address} · ${when(at)} · Tap to confirm`, data: { screen: 'today', showingId: id } }),
  cancelled: (address: string, at: Date, id: string): Note => ({ title: 'Visit cancelled by your client', body: `${address} · ${when(at)}`, data: { screen: 'today', showingId: id } }),
  soon: (address: string, at: Date, id: string): Note => ({
    title: `Visit at ${time(at)}`,
    body: `${address}. Check in opens at ${time(new Date(at.getTime() - GEOFENCE.earlyMinutes * 60_000))}, within ${GEOFENCE.radiusM} m of the home.`,
    data: { screen: 'today', showingId: id },
  }),
};

/** Minutes before a confirmed visit that the agent gets a "visit soon" push. */
export const REMINDER_MINUTES = 45;

/**
 * Sends each confirmed visit's reminder once. Marking the row first (with a guard on
 * reminder_sent_at) means two workers running together never both send it.
 */
export async function sendVisitReminders(db: Db, notify: NotifyService, now = new Date()): Promise<number> {
  const due = await db.update(showings).set({ reminderSentAt: now })
    .where(and(eq(showings.status, 'confirmed'), isNull(showings.reminderSentAt), isNull(showings.checkInAt),
      gt(showings.at, now), lte(showings.at, new Date(now.getTime() + REMINDER_MINUTES * 60_000))))
    .returning({ id: showings.id, at: showings.at, dealId: showings.dealId, listingId: showings.listingId });
  let sent = 0;
  for (const s of due) {
    const [row] = await db.select({
      agentId: deals.agentId,
      address: sql<string>`case when ${listings.unit} is null then ${listings.address} else ${listings.address} || ' #' || ${listings.unit} end`,
    }).from(deals).innerJoin(listings, eq(listings.id, s.listingId)).where(eq(deals.id, s.dealId));
    if (row?.agentId) sent += await notify.toUser(row.agentId, 'agent', visitNotes.soon(row.address, s.at, s.id));
  }
  return sent;
}
