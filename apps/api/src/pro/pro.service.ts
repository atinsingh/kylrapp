import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { GEOFENCE, type DecideShowingRequest, type GeoCheckRequest } from '@klyr/contracts';
import { TORONTO } from '@klyr/core';
import { DB, type Db } from '../db/db.module.js';
import {
  agents, auditLog, dealParties, deals, documents, idVerifications, listings, listingViews, moveProfiles, organizations, showings, users,
} from '../db/schema.js';
import { config } from '../config.js';
import { MAILER, type Mailer } from '../identity/mailer.js';

const MIN = 60_000, DAY = 86_400_000;
const when = (d: Date) => d.toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TORONTO });
const address = sql<string>`case when ${listings.unit} is null then ${listings.address} else ${listings.address} || ' #' || ${listings.unit} end`;

/** Klyr Pro for agents: only their own clients' deals. */
@Injectable()
export class ProService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(MAILER) private readonly mail: Mailer) {}

  async me(agentId: string) {
    const [a] = await this.db.select({ name: agents.registeredName, title: agents.title, reco: agents.recoNumber, brokerage: organizations.name })
      .from(agents).innerJoin(organizations, eq(organizations.id, agents.brokerageId)).where(eq(agents.userId, agentId));
    if (!a) throw new NotFoundException({ code: 'not_an_agent' });
    return a;
  }

  /** Visits on this agent's deals, from yesterday on. */
  async showings(agentId: string) {
    const rows = await this.db.select({
      id: showings.id, at: showings.at, status: showings.status, note: showings.note, agentNote: showings.agentNote,
      checkInAt: showings.checkInAt, checkInDistanceM: showings.checkInDistanceM, checkOutAt: showings.checkOutAt, checkOutDistanceM: showings.checkOutDistanceM,
      listingId: listings.id, address, city: listings.city, listingBrokerage: listings.listingBrokerage,
      lat: sql<number>`ST_Y(${listings.geom})`, lng: sql<number>`ST_X(${listings.geom})`,
      clientId: users.id, clientName: users.legalName, clientPhone: users.phone,
    }).from(showings)
      .innerJoin(deals, eq(deals.id, showings.dealId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .innerJoin(listings, eq(listings.id, showings.listingId))
      .where(and(eq(deals.agentId, agentId), gt(showings.at, new Date(Date.now() - DAY))))
      .orderBy(asc(showings.at));
    return rows.map(r => ({ ...r, at: r.at.toISOString(), checkInAt: r.checkInAt?.toISOString() ?? null, checkOutAt: r.checkOutAt?.toISOString() ?? null }));
  }

  /** Confirm, move or decline a visit; the buyer is emailed either way. */
  async decide(agentId: string, showingId: string, req: DecideShowingRequest) {
    const s = await this.ownShowing(agentId, showingId);
    if (s.status !== 'requested' && !(s.status === 'confirmed' && req.action !== 'confirm')) {
      throw new ConflictException({ code: 'not_open', message: 'This visit can no longer be changed.' });
    }
    let at = s.at;
    if (req.action === 'move') {
      at = new Date(req.at);
      if (at.getTime() < Date.now() + 30 * MIN || at.getTime() > Date.now() + 14 * DAY) throw new BadRequestException({ code: 'bad_time', message: 'Pick a time between 30 minutes and 14 days from now.' });
    }
    const status = req.action === 'decline' ? 'declined' as const : 'confirmed' as const;
    await this.db.update(showings).set({ status, at, agentNote: req.note ?? null, decidedBy: agentId, decidedAt: new Date() }).where(eq(showings.id, showingId));
    await this.db.insert(auditLog).values({ actorId: agentId, action: `showing_${req.action}`, entity: 'showing', entityId: showingId, data: { at: at.toISOString(), note: req.note ?? null } });

    const me = await this.me(agentId);
    const subject = { confirm: 'Your visit is confirmed', move: 'Your visit has a new time', decline: 'Your visit can’t go ahead' }[req.action];
    const body = req.action === 'decline'
      ? `${s.address}, ${when(s.at)}\n\n${me.name} says: ${req.note}\n\nYou can pick another time in Klyr.`
      : `${s.address}\n${when(at)}\n\n${me.name}, ${me.title} meets you there.${req.note ? `\n\n${me.name} says: ${req.note}` : ''}`;
    await this.mail.send({ to: s.clientEmail, subject, text: `${body}\n\nKlyr Realty Inc., Brokerage` });
    return { id: showingId, status, at: at.toISOString() };
  }

  /**
   * Geofenced check-in: the agent's device must be at the property, close to the visit time,
   * with a usable fix. Distance is measured here against the listing's location, not trusted from the device.
   */
  async checkIn(agentId: string, showingId: string, g: GeoCheckRequest) {
    const s = await this.ownShowing(agentId, showingId);
    await this.requirePhone(agentId, showingId, 'check_in', g);
    if (s.status !== 'confirmed') throw new ConflictException({ code: 'not_confirmed', message: 'Only confirmed visits can be checked in.' });
    if (s.checkInAt) throw new ConflictException({ code: 'already_checked_in', message: 'Already checked in.' });
    const now = Date.now();
    if (now < s.at.getTime() - GEOFENCE.earlyMinutes * MIN || now > s.at.getTime() + GEOFENCE.lateMinutes * MIN) {
      await this.refused(agentId, showingId, 'check_in', 'outside_window', g);
      throw new BadRequestException({ code: 'outside_window', message: `Check in from ${GEOFENCE.earlyMinutes} minutes before the visit until ${GEOFENCE.lateMinutes / 60} hours after.` });
    }
    const distance = await this.checkLocation(agentId, showingId, 'check_in', g);
    await this.db.update(showings).set({
      checkInAt: new Date(), checkInGeom: { x: g.lng, y: g.lat }, checkInDistanceM: distance, checkInAccuracyM: Math.round(g.accuracyM),
    }).where(eq(showings.id, showingId));
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'showing_check_in', entity: 'showing', entityId: showingId, data: { distanceM: distance, accuracyM: g.accuracyM, platform: g.platform } });
    return { checkedIn: true, distanceM: distance };
  }

  /** Completing a visit needs a check-in, time on site, and a second reading at the property. */
  async complete(agentId: string, showingId: string, g: GeoCheckRequest) {
    const s = await this.ownShowing(agentId, showingId);
    await this.requirePhone(agentId, showingId, 'complete', g);
    if (!s.checkInAt) throw new ConflictException({ code: 'not_checked_in', message: 'Check in at the property first.' });
    if (s.status === 'completed') throw new ConflictException({ code: 'already_completed', message: 'Already completed.' });
    if (Date.now() - s.checkInAt.getTime() < GEOFENCE.minOnSiteMinutes * MIN) {
      await this.refused(agentId, showingId, 'complete', 'too_soon', g);
      throw new BadRequestException({ code: 'too_soon', message: `A visit takes at least ${GEOFENCE.minOnSiteMinutes} minutes. Complete it when you’re done.` });
    }
    const distance = await this.checkLocation(agentId, showingId, 'complete', g);
    await this.db.update(showings).set({ status: 'completed', checkOutAt: new Date(), checkOutGeom: { x: g.lng, y: g.lat }, checkOutDistanceM: distance })
      .where(eq(showings.id, showingId));
    await this.db.insert(auditLog).values({ actorId: agentId, action: 'showing_complete', entity: 'showing', entityId: showingId, data: { distanceM: distance, accuracyM: g.accuracyM, platform: g.platform } });
    return { completed: true, distanceM: distance };
  }

  /** Buyers on this agent's deals, with where each one is in the first-visit steps. */
  async clients(agentId: string) {
    const rows = await this.db.select({ dealId: deals.id, stage: deals.stage, userId: users.id, name: users.legalName, email: users.email, phone: users.phone, since: deals.createdAt })
      .from(deals).innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(deals.agentId, agentId), eq(deals.side, 'buy'))).orderBy(desc(deals.createdAt));
    return Promise.all(rows.map(async r => ({ ...r, since: r.since.toISOString(), ...(await this.progress(r.dealId, r.userId)) })));
  }

  async client(agentId: string, userId: string) {
    const [row] = await this.db.select({ dealId: deals.id, stage: deals.stage, name: users.legalName, email: users.email, phone: users.phone })
      .from(deals).innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client'), eq(dealParties.userId, userId)))
      .innerJoin(users, eq(users.id, userId)).where(and(eq(deals.agentId, agentId), eq(deals.side, 'buy'))).limit(1);
    if (!row) throw new NotFoundException();
    const [progress, profile, saved, docs, visits] = await Promise.all([
      this.progress(row.dealId, userId),
      this.db.select({ plan: moveProfiles.plan, data: moveProfiles.data }).from(moveProfiles).where(eq(moveProfiles.userId, userId)),
      this.db.select({ id: listings.id, address, city: listings.city, price: listings.price }).from(listingViews)
        .innerJoin(listings, eq(listings.id, listingViews.listingId)).where(and(eq(listingViews.userId, userId), eq(listingViews.saved, true))),
      this.db.select({ id: documents.id, title: documents.title, createdAt: documents.createdAt }).from(documents).where(eq(documents.dealId, row.dealId)),
      this.db.select({ id: showings.id, at: showings.at, status: showings.status, address }).from(showings)
        .innerJoin(listings, eq(listings.id, showings.listingId)).where(eq(showings.dealId, row.dealId)).orderBy(desc(showings.at)),
    ]);
    return {
      ...row, ...progress, profile, saved,
      documents: docs.map(d => ({ ...d, createdAt: d.createdAt.toISOString() })),
      visits: visits.map(v => ({ ...v, at: v.at.toISOString() })),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private async progress(dealId: string, userId: string) {
    const [[agreement], [id], [visits]] = await Promise.all([
      this.db.select({ signedAt: documents.createdAt }).from(documents)
        .where(and(eq(documents.dealId, dealId), eq(documents.oreaForm, '300'), eq(documents.status, 'signed'))).orderBy(desc(documents.createdAt)).limit(1),
      this.db.select({ status: idVerifications.status }).from(idVerifications).where(eq(idVerifications.userId, userId)).orderBy(desc(idVerifications.verifiedAt)).limit(1),
      this.db.select({ n: count() }).from(showings).where(and(eq(showings.dealId, dealId), inArray(showings.status, ['requested', 'confirmed']))),
    ]);
    return { agreementSignedAt: agreement?.signedAt.toISOString() ?? null, idStatus: id?.status ?? 'not_started', openVisits: visits?.n ?? 0 };
  }

  private async ownShowing(agentId: string, showingId: string) {
    const [s] = await this.db.select({
      id: showings.id, at: showings.at, status: showings.status, checkInAt: showings.checkInAt, listingId: showings.listingId,
      address, clientEmail: users.email,
    }).from(showings)
      .innerJoin(deals, eq(deals.id, showings.dealId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .innerJoin(listings, eq(listings.id, showings.listingId))
      .where(and(eq(showings.id, showingId), eq(deals.agentId, agentId)));
    if (!s) throw new NotFoundException();
    return s;
  }

  /** Only the phone app reads native GPS and can report mock locations; a browser can't. */
  private async requirePhone(agentId: string, showingId: string, step: 'check_in' | 'complete', g: GeoCheckRequest) {
    if (g.platform !== 'web' || config.geofenceAllowWeb) return;
    await this.refused(agentId, showingId, step, 'not_phone', g);
    throw new BadRequestException({ code: 'use_phone_app', message: 'Check in with the Klyr app on your phone. It reads your location from the phone’s GPS.' });
  }

  /** Accuracy, mock-location and distance checks shared by check-in and completion. Returns metres from the property. */
  private async checkLocation(agentId: string, showingId: string, step: 'check_in' | 'complete', g: GeoCheckRequest) {
    if (g.mocked) {
      await this.refused(agentId, showingId, step, 'mocked_location', g);
      throw new BadRequestException({ code: 'mocked_location', message: 'Turn off any mock-location app and try again.' });
    }
    if (g.accuracyM > GEOFENCE.maxAccuracyM) {
      await this.refused(agentId, showingId, step, 'low_accuracy', g);
      throw new BadRequestException({ code: 'low_accuracy', message: `Your location is only accurate to ${Math.round(g.accuracyM)} m. Step outside or turn on precise location and try again.` });
    }
    const [row] = await this.db.select({
      d: sql<number>`round(ST_Distance(${listings.geom}::geography, ST_SetSRID(ST_MakePoint(${g.lng}, ${g.lat}), 4326)::geography))::int`,
    }).from(showings).innerJoin(listings, eq(listings.id, showings.listingId)).where(eq(showings.id, showingId));
    const distance = row!.d;
    if (distance > GEOFENCE.radiusM) {
      await this.refused(agentId, showingId, step, 'too_far', g, distance);
      throw new BadRequestException({ code: 'too_far', message: `You’re ${distance >= 1000 ? (distance / 1000).toFixed(1) + ' km' : distance + ' m'} from the property. Check in when you’re there.`, distanceM: distance });
    }
    return distance;
  }

  /** Every refused attempt is kept for the broker of record. */
  private refused(agentId: string, showingId: string, step: string, reason: string, g: GeoCheckRequest, distanceM?: number) {
    return this.db.insert(auditLog).values({ actorId: agentId, action: `showing_${step}_refused`, entity: 'showing', entityId: showingId, data: { reason, lat: g.lat, lng: g.lng, accuracyM: g.accuracyM, mocked: !!g.mocked, platform: g.platform, distanceM: distanceM ?? null } });
  }
}
