import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { SearchFilters } from '@klyr/contracts';
import { torontoInstant, torontoToday } from '@klyr/core';
import type { Db } from '../db/db.module.js';
import { listings, savedSearches, savedSearchHits, users } from '../db/schema.js';
import type { Mailer } from '../identity/mailer.js';
import type { NotifyService } from '../notify/notify.service.js';
import { filterWhere } from './listings.service.js';

type Ctx = { db: Db; notify: NotifyService; mail: Mailer };
const money = (n: number) => '$' + n.toLocaleString('en-CA');
const address = sql<string>`case when ${listings.unit} is null then ${listings.address} else ${listings.address} || ' #' || ${listings.unit} end`;
/** Daily digests go out from 7 am Toronto. */
export const DAILY_HOUR = 7;

/** Homes matching a search now (VOW cap applies to alerts too). */
export function matches(db: Db, f: SearchFilters) {
  return db.select({ id: listings.id, price: listings.price, address, city: listings.city }).from(listings).where(and(...filterWhere(f))).limit(100);
}

/** On saving: remember what already matches, so alerts only cover what changes afterwards. */
export async function snapshot(db: Db, searchId: string, f: SearchFilters) {
  const now = await matches(db, f);
  if (now.length) await db.insert(savedSearchHits).values(now.map(m => ({ searchId, listingId: m.id, price: m.price }))).onConflictDoNothing();
  return now.length;
}

/**
 * New listings and price drops for each saved search due now: "instant" ones every run, "daily" ones once a
 * morning. One email per search with what changed; a push that names no prices.
 */
export async function sendSearchAlerts(x: Ctx, now = new Date(), webUrl = process.env.WEB_URL ?? 'https://klyr.ca'): Promise<number> {
  const [y, m, d] = torontoToday(now);
  const morning = torontoInstant(y, m, d, DAILY_HOUR, 0);
  const due = await x.db.select({ s: savedSearches, email: users.email }).from(savedSearches).innerJoin(users, eq(users.id, savedSearches.userId))
    .where(or(eq(savedSearches.alert, 'instant'),
      now >= morning ? and(eq(savedSearches.alert, 'daily'), or(isNull(savedSearches.lastAlertedAt), lt(savedSearches.lastAlertedAt, morning))) : sql`false`));
  let sent = 0;
  for (const { s, email } of due) {
    const found = await matches(x.db, s.filters as SearchFilters);
    const hits = found.length ? await x.db.select().from(savedSearchHits).where(and(eq(savedSearchHits.searchId, s.id), inArray(savedSearchHits.listingId, found.map(f => f.id)))) : [];
    const fresh = found.filter(f => !hits.some(h => h.listingId === f.id));
    const drops = found.flatMap(f => { const h = hits.find(z => z.listingId === f.id); return h && f.price < h.price ? [{ ...f, was: h.price }] : []; });
    if (fresh.length) await x.db.insert(savedSearchHits).values(fresh.map(f => ({ searchId: s.id, listingId: f.id, price: f.price }))).onConflictDoNothing();
    for (const f of found) {
      const h = hits.find(z => z.listingId === f.id);
      if (h && h.price !== f.price) await x.db.update(savedSearchHits).set({ price: f.price }).where(and(eq(savedSearchHits.searchId, s.id), eq(savedSearchHits.listingId, f.id)));
    }
    await x.db.update(savedSearches).set({ lastAlertedAt: now }).where(eq(savedSearches.id, s.id));
    if (!fresh.length && !drops.length) continue;
    const parts = [fresh.length && `${fresh.length} new`, drops.length && `${drops.length} price drop${drops.length > 1 ? 's' : ''}`].filter(Boolean).join(', ');
    const lines = [
      ...fresh.map(f => `New: ${f.address}, ${f.city} · ${money(f.price)}\n${webUrl}/listings/${f.id}`),
      ...drops.map(f => `Price drop: ${f.address}, ${f.city} · now ${money(f.price)} (was ${money(f.was)})\n${webUrl}/listings/${f.id}`),
    ];
    await x.mail.send({ to: email, subject: `${s.name}: ${parts}`, text: `${lines.join('\n\n')}\n\nChange or turn off this alert under Saved in Klyr.\n\nKlyr Realty Inc., Brokerage` });
    await x.notify.toUser(s.userId, 'consumer', { title: s.name, body: parts, data: { screen: 'searches' } });
    sent++;
  }
  return sent;
}
