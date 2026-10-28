/** Seeds the six sample listings from design/prototype/klyr-app.js so local screens match the design. */
import { sql } from 'drizzle-orm';
import { createDb } from './client.js';
import { listings } from './schema.js';

type Sample = {
  mls: string; address: string; unit?: string; city: string; hood: string;
  type: 'House' | 'Townhouse' | 'Condo'; style: string; beds: number; baths: number; sqft: number;
  built: number; price: number; coop: string; tax: number; fee?: number; lat: number; lng: number;
};

const SAMPLE: Sample[] = [
  { mls: 'SEED-0001', address: '41 Maple Cres', city: 'Mississauga', hood: 'Applewood', type: 'House', style: 'Detached', beds: 4, baths: 3, sqft: 2350, built: 1998, price: 1_150_000, coop: '0.0220', tax: 6960, lat: 43.6046, lng: -79.5958 },
  { mls: 'SEED-0002', address: '250 Queens Quay W', unit: '1204', city: 'Toronto', hood: 'Harbourfront', type: 'Condo', style: 'Apartment', beds: 2, baths: 2, sqft: 880, built: 2009, price: 689_000, coop: '0.0250', tax: 2840, fee: 712, lat: 43.6389, lng: -79.3851 },
  { mls: 'SEED-0003', address: '9 Fern Ln', city: 'Oakville', hood: 'College Park', type: 'House', style: 'Detached', beds: 3, baths: 3, sqft: 1780, built: 1986, price: 1_049_000, coop: '0.0200', tax: 5410, lat: 43.4719, lng: -79.7004 },
  { mls: 'SEED-0004', address: '1207 Willowbrook Dr', city: 'Mississauga', hood: 'Clarkson', type: 'Townhouse', style: 'Freehold town', beds: 3, baths: 3, sqft: 1540, built: 2004, price: 879_000, coop: '0.0250', tax: 4720, lat: 43.5131, lng: -79.6327 },
  { mls: 'SEED-0005', address: '63 Galley Ave', city: 'Toronto', hood: 'Roncesvalles', type: 'House', style: 'Semi-detached', beds: 3, baths: 2, sqft: 1620, built: 1912, price: 1_295_000, coop: '0.0200', tax: 6120, lat: 43.6411, lng: -79.4469 },
  { mls: 'SEED-0006', address: '402 Rebecca St', unit: '305', city: 'Oakville', hood: 'Old Oakville', type: 'Condo', style: 'Apartment', beds: 2, baths: 2, sqft: 1010, built: 2016, price: 739_000, coop: '0.0250', tax: 3380, fee: 640, lat: 43.4441, lng: -79.6797 },
];

const { db, pool } = createDb();
await db.insert(listings).values(SAMPLE.map(l => ({
  mlsNumber: l.mls, source: 'seed' as const, status: 'active' as const, kind: 'sale' as const,
  listingBrokerage: 'Sample Realty Inc., Brokerage', address: l.address, unit: l.unit ?? null,
  city: l.city, neighbourhood: l.hood, propertyType: l.type, style: l.style, beds: l.beds, baths: l.baths,
  sqft: l.sqft, yearBuilt: l.built, price: l.price, coop: l.coop, annualTax: l.tax, condoFee: l.fee ?? null,
  geom: { x: l.lng, y: l.lat },
}))).onConflictDoUpdate({ target: [listings.source, listings.mlsNumber], set: { price: sql`excluded.price` } });
await pool.end();
console.log(`seeded ${SAMPLE.length} listings`);
