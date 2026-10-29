import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, sql, type SQL } from 'drizzle-orm';
import { buyerEstimate, DEFAULT_ASSUMPTIONS, type PropertyType } from '@klyr/core';
import type { ListingSearch } from '@klyr/contracts';
import { DB, type Db } from '../db/db.module.js';
import { config } from '../config.js';
import { listingEvents, listingInsights, listingMedia, listings, listingViews } from '../db/schema.js';

/** PropTx VOW rules cap a single search at 100 listings. */
export const VOW_RESULT_CAP = 100;
/** Comparables: same type, sold within this radius and window. */
const COMP_RADIUS_M = 2_000;
const COMP_WINDOW_DAYS = 180;

type Row = typeof listings.$inferSelect;

@Injectable()
export class ListingsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async search(userId: string, q: ListingSearch) {
    const where: SQL[] = [eq(listings.status, 'active'), eq(listings.kind, q.kind), eq(listings.internetDisplay, true)];
    if (q.city) where.push(inArray(listings.city, q.city.split(',').map(c => c.trim()).filter(Boolean)));
    if (q.minPrice != null) where.push(gte(listings.price, q.minPrice));
    if (q.maxPrice != null) where.push(lte(listings.price, q.maxPrice));
    if (q.minBeds != null) where.push(gte(listings.beds, q.minBeds));
    if (q.type) where.push(eq(listings.propertyType, q.type));
    if (q.near) {
      where.push(sql`ST_DWithin(${listings.geom}::geography, ST_SetSRID(ST_MakePoint(${q.near.lng}, ${q.near.lat}), 4326)::geography, ${q.near.radiusM})`);
    }
    if (q.saved) where.push(sql`exists (select 1 from ${listingViews} v where v.listing_id = ${listings.id} and v.user_id = ${userId} and v.saved)`);
    const order = { price_asc: [asc(listings.price)], price_desc: [desc(listings.price)], newest: [desc(listings.listedAt), asc(listings.price)] }[q.sort];
    const rows = await this.db.select().from(listings).where(and(...where)).orderBy(...order).limit(VOW_RESULT_CAP + 1);
    const shown = rows.slice(0, VOW_RESULT_CAP);
    const ids = shown.map(r => r.id);
    const [photos, views] = await Promise.all([this.photos(ids, 10), this.views(userId, ids)]);
    return {
      results: shown.map(r => this.card(r, photos.get(r.id) ?? [], views.get(r.id))),
      /** Client shows "Refine your search" when true. */
      capped: rows.length > VOW_RESULT_CAP,
    };
  }

  /** The raw row, for internal callers such as estimates. */
  async get(id: string): Promise<Row> {
    const [row] = await this.db.select().from(listings)
      .where(and(eq(listings.id, id), eq(listings.internetDisplay, true), eq(listings.status, 'active')));
    if (!row) throw new NotFoundException();
    return row;
  }

  /** Everything the listing page shows. Opening it records the view for the "Viewed" badge. */
  async detail(userId: string, id: string) {
    const r = await this.get(id);
    const [photos, history, [insights], comparables] = await Promise.all([
      this.photos([id], 50),
      this.db.select({ at: listingEvents.at, event: listingEvents.event, price: listingEvents.price })
        .from(listingEvents).where(eq(listingEvents.listingId, id)).orderBy(desc(listingEvents.at)),
      this.db.select().from(listingInsights).where(eq(listingInsights.listingId, id)),
      this.comparables(r),
    ]);
    const [view] = await this.db.insert(listingViews).values({ userId, listingId: id })
      .onConflictDoUpdate({ target: [listingViews.userId, listingViews.listingId], set: { lastViewedAt: new Date() } })
      .returning();
    const estimate = buyerEstimate(toEstimateInput(r));
    return {
      ...this.card(r, photos.get(id) ?? [], view),
      style: r.style, yearBuilt: r.yearBuilt, lot: r.lot, parking: r.parking, heating: r.heating,
      annualTax: r.annualTax, condoFee: r.condoFee, coop: Number(r.coop ?? 0),
      openHouse: r.openHouse, offerDate: r.offerDate,
      daysOnMarket: r.listedAt ? Math.max(0, Math.round((Date.now() - Date.parse(r.listedAt)) / 86_400_000)) : null,
      estimate: { ...estimate, asOf: DEFAULT_ASSUMPTIONS.asOf, downPct: DEFAULT_ASSUMPTIONS.downPct },
      history,
      comparables,
      insights: insights ? { schools: insights.schools, commute: insights.commute, nearby: insights.nearby } : null,
    };
  }

  async setSaved(userId: string, id: string, saved: boolean) {
    await this.get(id);
    await this.db.insert(listingViews).values({ userId, listingId: id, saved })
      .onConflictDoUpdate({ target: [listingViews.userId, listingViews.listingId], set: { saved } });
    return { saved };
  }

  /** Sold homes of the same type nearby, most recent first. Sold prices are VOW data: signed-in users only. */
  private comparables(r: Row) {
    const dist = sql<number>`ST_Distance(${listings.geom}::geography, ST_SetSRID(ST_MakePoint(${r.geom.x}, ${r.geom.y}), 4326)::geography)`;
    return this.db.select({
      address: sql<string>`case when ${listings.unit} is null then ${listings.address} else ${listings.address} || ' #' || ${listings.unit} end`,
      beds: listings.beds, sqft: listings.sqft, soldPrice: listings.soldPrice, soldAt: listings.soldAt,
      distanceM: sql<number>`round(${dist})::int`,
    }).from(listings).where(and(
      eq(listings.status, 'sold'), eq(listings.propertyType, r.propertyType), ne(listings.id, r.id), isNotNull(listings.soldPrice),
      gte(listings.soldAt, sql`current_date - ${COMP_WINDOW_DAYS}::int`),
      sql`ST_DWithin(${listings.geom}::geography, ST_SetSRID(ST_MakePoint(${r.geom.x}, ${r.geom.y}), 4326)::geography, ${COMP_RADIUS_M})`,
    )).orderBy(desc(listings.soldAt)).limit(5);
  }

  /** Photos per listing, in feed order. */
  private async photos(ids: string[], perListing: number) {
    const byListing = new Map<string, Photo[]>();
    if (!ids.length) return byListing;
    const rows = await this.db.select().from(listingMedia)
      .where(and(inArray(listingMedia.listingId, ids), eq(listingMedia.kind, 'photo')))
      .orderBy(asc(listingMedia.listingId), asc(listingMedia.position));
    for (const m of rows) {
      const list = byListing.get(m.listingId) ?? [];
      if (list.length < perListing) list.push({ url: mediaUrl(m.url), alt: m.altText ?? '' });
      byListing.set(m.listingId, list);
    }
    return byListing;
  }

  private async views(userId: string, ids: string[]) {
    if (!ids.length) return new Map<string, View>();
    const rows = await this.db.select().from(listingViews).where(and(eq(listingViews.userId, userId), inArray(listingViews.listingId, ids)));
    return new Map(rows.map(v => [v.listingId, v]));
  }

  /** Search card: every card carries the listing brokerage, the all-in hero and its photos. */
  private card(r: Row, photos: Photo[], view?: View) {
    const est = buyerEstimate(toEstimateInput(r));
    return {
      id: r.id, mlsNumber: r.mlsNumber, address: r.unit ? `${r.address} #${r.unit}` : r.address, city: r.city,
      neighbourhood: r.neighbourhood, type: r.propertyType, beds: r.beds, baths: r.baths, sqft: r.sqft,
      price: r.price, lat: r.geom.y, lng: r.geom.x, listingBrokerage: r.listingBrokerage,
      allIn: est.allIn, cashBack: est.cashBack, monthly: Math.round(est.monthly),
      photos,
      /** Seed data uses stand-in photos; the app labels them so nobody mistakes them for the real home. */
      samplePhotos: r.source === 'seed',
      saved: view?.saved ?? false,
      viewedAt: view?.lastViewedAt?.toISOString() ?? null,
    };
  }
}

interface Photo { url: string; alt: string }
type View = typeof listingViews.$inferSelect;

/** Relative media paths are served from MEDIA_BASE_URL; feed photos already carry absolute URLs. */
const mediaUrl = (u: string) => (u.startsWith('/') ? config.mediaBaseUrl + u : u);

export function toEstimateInput(r: Row) {
  return {
    price: r.price, city: r.city, type: r.propertyType as PropertyType,
    coop: Number(r.coop ?? 0.025), tax: r.annualTax ?? 0, fee: r.condoFee ?? undefined,
  };
}
