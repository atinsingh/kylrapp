import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { buyerEstimate, type PropertyType } from '@klyr/core';
import type { ListingSearch } from '@klyr/contracts';
import { DB, type Db } from '../db/db.module.js';
import { listings } from '../db/schema.js';

/** PropTx VOW rules cap a single search at 100 listings. */
export const VOW_RESULT_CAP = 100;

type Row = typeof listings.$inferSelect;

@Injectable()
export class ListingsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async search(q: ListingSearch) {
    const where: SQL[] = [eq(listings.status, 'active'), eq(listings.kind, q.kind), eq(listings.internetDisplay, true)];
    if (q.city) where.push(eq(listings.city, q.city));
    if (q.minPrice != null) where.push(gte(listings.price, q.minPrice));
    if (q.maxPrice != null) where.push(lte(listings.price, q.maxPrice));
    if (q.minBeds != null) where.push(gte(listings.beds, q.minBeds));
    if (q.type) where.push(eq(listings.propertyType, q.type));
    if (q.near) {
      where.push(sql`ST_DWithin(${listings.geom}::geography, ST_SetSRID(ST_MakePoint(${q.near.lng}, ${q.near.lat}), 4326)::geography, ${q.near.radiusM})`);
    }
    const rows = await this.db.select().from(listings).where(and(...where)).orderBy(asc(listings.price)).limit(VOW_RESULT_CAP + 1);
    return {
      results: rows.slice(0, VOW_RESULT_CAP).map(r => this.card(r)),
      /** Client shows "Refine your search" when true. */
      capped: rows.length > VOW_RESULT_CAP,
    };
  }

  async get(id: string) {
    const [row] = await this.db.select().from(listings).where(and(eq(listings.id, id), eq(listings.internetDisplay, true)));
    if (!row) throw new NotFoundException();
    return row;
  }

  /** Search card: every card carries the listing brokerage and the all-in hero. */
  private card(r: Row) {
    const est = buyerEstimate(toEstimateInput(r));
    return {
      id: r.id, mlsNumber: r.mlsNumber, address: r.unit ? `${r.address} #${r.unit}` : r.address, city: r.city,
      neighbourhood: r.neighbourhood, type: r.propertyType, beds: r.beds, baths: r.baths, sqft: r.sqft,
      price: r.price, lat: r.geom.y, lng: r.geom.x, listingBrokerage: r.listingBrokerage,
      allIn: est.allIn, cashBack: est.cashBack, monthly: Math.round(est.monthly),
    };
  }
}

export function toEstimateInput(r: Row) {
  return {
    price: r.price, city: r.city, type: r.propertyType as PropertyType,
    coop: Number(r.coop ?? 0.025), tax: r.annualTax ?? 0, fee: r.condoFee ?? undefined,
  };
}
