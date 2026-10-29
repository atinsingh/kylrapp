/**
 * Seeds the six sample listings from design/prototype/klyr-app.js so local screens match the design:
 * details, price history, schools and commute, stand-in photos, and the "sold nearby" homes as
 * sold listings so comparables come from a real nearby-sales query.
 */
import { inArray, sql } from 'drizzle-orm';
import { createDb } from './client.js';
import { agents, listingEvents, listingInsights, listingMedia, listings, organizations, userRoles, users } from './schema.js';

type Kind = 'House' | 'Townhouse' | 'Condo';
type Sample = {
  mls: string; address: string; unit?: string; city: string; hood: string; type: Kind; style: string;
  beds: number; baths: number; sqft: number; built: number; price: number; coop: string; tax: number; fee?: number;
  lat: number; lng: number; listed: string; lot?: string; parking: string; heating: string; open: string; offers: string;
  /** [date, event, price]; dates like "Oct 21, 2026" or "Aug 2019". */
  history: [string, 'listed' | 'price_change' | 'sold', number][];
  /** Sold nearby: [address, beds, sqft, price, month]. */
  comps: [string, number, number | null, number, string][];
  schools: [string, string, string][];
  commute: [string, string, string][];
  nearby: string;
};

const SAMPLE: Sample[] = [
  { mls: 'SEED-0001', address: '41 Maple Cres', city: 'Mississauga', hood: 'Applewood', type: 'House', style: 'Detached', beds: 4, baths: 3, sqft: 2350, built: 1998, price: 1_150_000, coop: '0.0220', tax: 6960, lat: 43.6046, lng: -79.5958,
    listed: '2026-10-21', lot: '50 × 120 ft', parking: '2-car garage', heating: 'Gas forced air · central AC', open: 'Sat Oct 31 · 2–4 pm', offers: 'Tue Nov 3 · 7 pm',
    history: [['Oct 21, 2026', 'listed', 1_150_000], ['Jun 12, 2014', 'sold', 640_000], ['May 2, 2014', 'listed', 649_900]],
    comps: [['52 Maple Cres', 4, 2280, 1_128_000, 'Sep 2026'], ['17 Oakmont Dr', 4, 2410, 1_172_000, 'Aug 2026'], ['9 Sycamore Crt', 3, 2050, 1_095_000, 'Jul 2026']],
    schools: [['Maple Ridge PS', 'JK–8 · public', '0.6 km'], ['St. Catherine CS', 'JK–8 · Catholic', '0.9 km'], ['Applewood Heights SS', '9–12 · public', '1.4 km']],
    commute: [['Union Station', 'GO train from Cooksville', '52 min'], ['Union Station', 'Drive, 8 am', '41 min'], ['Square One', 'Bus', '24 min']],
    nearby: 'Parks 3 within 1 km · grocery 0.8 km · GO station 2.6 km' },
  { mls: 'SEED-0002', address: '250 Queens Quay W', unit: '1204', city: 'Toronto', hood: 'Harbourfront', type: 'Condo', style: 'Apartment', beds: 2, baths: 2, sqft: 880, built: 2009, price: 689_000, coop: '0.0250', tax: 2840, fee: 712, lat: 43.6389, lng: -79.3851,
    listed: '2026-10-09', parking: '1 parking · 1 locker', heating: 'Fan coil · fee includes heat, water', open: 'Sun Nov 1 · 1–3 pm', offers: 'Any time',
    history: [['Oct 9, 2026', 'listed', 699_000], ['Oct 23, 2026', 'price_change', 689_000], ['Aug 2019', 'sold', 655_000]],
    comps: [['250 Queens Quay W #907', 2, 860, 672_000, 'Sep 2026'], ['230 Queens Quay W #1510', 2, 910, 701_000, 'Aug 2026'], ['260 Queens Quay W #604', 2, 840, 655_000, 'Jul 2026']],
    schools: [['Waterfront School', 'JK–8 · public', '0.4 km'], ['Jarvis CI', '9–12 · public', '2.1 km']],
    commute: [['Union Station', 'Streetcar', '12 min'], ['Union Station', 'Walk', '18 min']],
    nearby: 'Lakefront trail 0.1 km · grocery 0.3 km · status certificate ordered' },
  { mls: 'SEED-0003', address: '9 Fern Ln', city: 'Oakville', hood: 'College Park', type: 'House', style: 'Detached', beds: 3, baths: 3, sqft: 1780, built: 1986, price: 1_049_000, coop: '0.0200', tax: 5410, lat: 43.4719, lng: -79.7004,
    listed: '2026-10-23', lot: '45 × 110 ft', parking: '1-car garage', heating: 'Gas forced air · central AC', open: 'Sat Oct 31 · 1–3 pm', offers: 'Mon Nov 2 · 6 pm',
    history: [['Oct 23, 2026', 'listed', 1_049_000], ['Mar 2009', 'sold', 478_000]],
    comps: [['14 Fern Ln', 3, 1720, 1_032_000, 'Aug 2026'], ['220 Sumner Rd', 3, 1850, 1_068_000, 'Jun 2026']],
    schools: [['Sunningdale PS', 'JK–8 · public', '0.7 km'], ['White Oaks SS', '9–12 · public', '1.1 km']],
    commute: [['Union Station', 'GO train from Oakville', '44 min'], ['Union Station', 'Drive, 8 am', '55 min']],
    nearby: 'Sheridan College 1.2 km · grocery 0.6 km · GO station 2.0 km' },
  { mls: 'SEED-0004', address: '1207 Willowbrook Dr', city: 'Mississauga', hood: 'Clarkson', type: 'Townhouse', style: 'Freehold town', beds: 3, baths: 3, sqft: 1540, built: 2004, price: 879_000, coop: '0.0250', tax: 4720, lat: 43.5131, lng: -79.6327,
    listed: '2026-10-16', lot: '20 × 100 ft', parking: '1-car garage', heating: 'Gas forced air · central AC', open: 'Sun Nov 1 · 2–4 pm', offers: 'Any time',
    history: [['Oct 16, 2026', 'listed', 899_000], ['Oct 25, 2026', 'price_change', 879_000], ['Apr 2017', 'sold', 702_000]],
    comps: [['1211 Willowbrook Dr', 3, 1520, 862_000, 'Sep 2026'], ['1195 Willowbrook Dr', 3, 1560, 890_000, 'Jul 2026']],
    schools: [['Hillside PS', 'JK–8 · public', '0.5 km'], ['Lorne Park SS', '9–12 · public', '2.3 km']],
    commute: [['Union Station', 'GO train from Clarkson', '38 min'], ['Union Station', 'Drive, 8 am', '46 min']],
    nearby: 'Clarkson GO 1.1 km · grocery 0.4 km' },
  { mls: 'SEED-0005', address: '63 Galley Ave', city: 'Toronto', hood: 'Roncesvalles', type: 'House', style: 'Semi-detached', beds: 3, baths: 2, sqft: 1620, built: 1912, price: 1_295_000, coop: '0.0200', tax: 6120, lat: 43.6411, lng: -79.4469,
    listed: '2026-10-24', lot: '18 × 125 ft', parking: 'Laneway parking', heating: 'Gas boiler · radiators', open: 'Sat Oct 31 · 2–4 pm', offers: 'Wed Nov 4 · 7 pm',
    history: [['Oct 24, 2026', 'listed', 1_295_000], ['Nov 2011', 'sold', 612_000]],
    comps: [['71 Galley Ave', 3, null, 1_318_000, 'Sep 2026'], ['40 Fern Ave', 3, null, 1_260_000, 'Jul 2026']],
    schools: [['Fern Avenue PS', 'JK–8 · public', '0.3 km'], ['Parkdale CI', '9–12 · public', '1.0 km']],
    commute: [['Union Station', 'Streetcar + subway', '28 min'], ['Union Station', 'Bike', '22 min']],
    nearby: 'High Park 0.8 km · Roncesvalles shops 0.2 km' },
  { mls: 'SEED-0006', address: '402 Rebecca St', unit: '305', city: 'Oakville', hood: 'Old Oakville', type: 'Condo', style: 'Apartment', beds: 2, baths: 2, sqft: 1010, built: 2016, price: 739_000, coop: '0.0250', tax: 3380, fee: 640, lat: 43.4441, lng: -79.6797,
    listed: '2026-10-05', parking: '1 parking · 1 locker', heating: 'Heat pump · fee includes water', open: 'By appointment', offers: 'Any time',
    history: [['Oct 5, 2026', 'listed', 759_000], ['Oct 20, 2026', 'price_change', 739_000]],
    comps: [['400 Rebecca St #208', 2, 980, 728_000, 'Aug 2026']],
    schools: [['New Central PS', 'JK–8 · public', '0.5 km'], ['Oakville Trafalgar HS', '9–12 · public', '1.3 km']],
    commute: [['Union Station', 'GO train from Oakville', '44 min']],
    nearby: 'Lakeshore shops 0.4 km · harbour 0.6 km' },
];

/** The four stand-in photos from the design bundle; each listing starts on the one the prototype used. */
const PHOTOS = [
  'Stone two-storey house with a double garage, lit at dusk',
  'Stone two-storey house with a double garage and front garden',
  'Brick two-storey house with a double garage and interlock driveway',
  'Brick two-storey house with a double garage and landscaped front yard',
];
const FIRST_PHOTO: Record<string, number> = { 'SEED-0001': 1, 'SEED-0002': 2, 'SEED-0003': 3, 'SEED-0004': 4, 'SEED-0005': 1, 'SEED-0006': 2 };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 21, 2026" → 2026-10-21; "Aug 2019" → 2019-08-15. */
function isoDate(s: string): string {
  const m = s.match(/^([A-Z][a-z]{2}) (?:(\d{1,2}), )?(\d{4})$/);
  if (!m) throw new Error(`bad date ${s}`);
  return `${m[3]}-${String(MONTHS.indexOf(m[1]!) + 1).padStart(2, '0')}-${String(m[2] ?? 15).padStart(2, '0')}`;
}
const splitUnit = (a: string) => { const [address, unit] = a.split(' #'); return { address: address!, unit: unit ?? null }; };

const { db, pool } = createDb();
const base = { source: 'seed' as const, kind: 'sale' as const, listingBrokerage: 'Sample Realty Inc., Brokerage' };

const saved = await db.insert(listings).values(SAMPLE.map(l => ({
  ...base, mlsNumber: l.mls, status: 'active' as const, address: l.address, unit: l.unit ?? null,
  city: l.city, neighbourhood: l.hood, propertyType: l.type, style: l.style, beds: l.beds, baths: l.baths,
  sqft: l.sqft, yearBuilt: l.built, price: l.price, coop: l.coop, annualTax: l.tax, condoFee: l.fee ?? null,
  geom: { x: l.lng, y: l.lat }, listedAt: l.listed, lot: l.lot ?? null, parking: l.parking, heating: l.heating,
  openHouse: l.open, offerDate: l.offers,
}))).onConflictDoUpdate({
  target: [listings.source, listings.mlsNumber],
  set: Object.fromEntries(['price', 'listed_at', 'lot', 'parking', 'heating', 'open_house', 'offer_date'].map(c => [
    c.replace(/_(\w)/g, (_, x: string) => x.toUpperCase()), sql.raw(`excluded.${c}`),
  ])),
}).returning({ id: listings.id, mls: listings.mlsNumber });

const ids = saved.map(s => s.id);
await db.delete(listingMedia).where(inArray(listingMedia.listingId, ids));
await db.delete(listingEvents).where(inArray(listingEvents.listingId, ids));
await db.delete(listingInsights).where(inArray(listingInsights.listingId, ids));
// Sold comparables are re-created on every run.
await db.delete(listings).where(sql`${listings.source} = 'seed' and ${listings.mlsNumber} like 'SEED-S%'`);

let sold = 0;
for (const row of saved) {
  const l = SAMPLE.find(x => x.mls === row.mls)!;
  const first = (FIRST_PHOTO[l.mls] ?? 1) - 1;
  await db.insert(listingMedia).values(PHOTOS.map((_, i) => {
    const n = (first + i) % PHOTOS.length;
    return { listingId: row.id, kind: 'photo' as const, url: `/media/sample/home-${n + 1}-1200.jpg`, altText: PHOTOS[n]!, position: i };
  }));
  await db.insert(listingEvents).values(l.history.map(([d, event, price]) => ({ listingId: row.id, at: isoDate(d), event, price })));
  await db.insert(listingInsights).values({
    listingId: row.id, source: 'sample',
    schools: l.schools.map(([name, grades, distance]) => ({ name, grades, distance })),
    commute: l.commute.map(([to, how, time]) => ({ to, how, time })),
    nearby: l.nearby,
  });
  // Place each comparable a few hundred metres from the listing.
  await db.insert(listings).values(l.comps.map(([addr, beds, sqft, price, month], i) => ({
    ...base, mlsNumber: `SEED-S${String(++sold).padStart(3, '0')}`, status: 'sold' as const, ...splitUnit(addr),
    city: l.city, neighbourhood: l.hood, propertyType: l.type, style: l.style, beds, baths: l.baths, sqft,
    price, soldPrice: price, soldAt: isoDate(month), coop: l.coop, annualTax: l.tax,
    geom: { x: l.lng + 0.002 * (i + 1), y: l.lat - 0.0015 * (i + 1) },
  })));
}
// The brokerage and its agents. Names, titles and registration numbers are placeholders until the
// broker of record confirms them (Launch Checklist action 2).
let [brokerage] = await db.select().from(organizations).where(sql`${organizations.kind} = 'brokerage' and ${organizations.name} = 'Klyr Realty Inc., Brokerage'`);
if (!brokerage) [brokerage] = await db.insert(organizations).values({ kind: 'brokerage', name: 'Klyr Realty Inc., Brokerage', registration: 'RECO registration pending' }).returning();
const AGENTS = [
  { email: 'maya.chen@klyr.example', name: 'Maya Chen', title: 'Salesperson' as const, reco: 'SAMPLE-0001' },
  { email: 'daniel.okafor@klyr.example', name: 'Daniel Okafor', title: 'Salesperson' as const, reco: 'SAMPLE-0002' },
];
for (const a of AGENTS) {
  let [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${a.email}`);
  if (!u) [u] = await db.insert(users).values({ email: a.email, legalName: a.name, emailVerifiedAt: new Date() }).returning();
  await db.insert(userRoles).values({ userId: u!.id, role: 'agent', orgId: brokerage!.id }).onConflictDoNothing();
  await db.insert(agents).values({ userId: u!.id, brokerageId: brokerage!.id, registeredName: a.name, title: a.title, recoNumber: a.reco })
    .onConflictDoNothing();
}
// Broker of record and compliance officer (placeholder until confirmed).
const OFFICER = { email: 'priya.nair@klyr.example', name: 'Priya Nair' };
let [officer] = await db.select().from(users).where(sql`lower(${users.email}) = ${OFFICER.email}`);
if (!officer) [officer] = await db.insert(users).values({ email: OFFICER.email, legalName: OFFICER.name, emailVerifiedAt: new Date() }).returning();
await db.insert(userRoles).values([
  { userId: officer!.id, role: 'compliance_officer', orgId: brokerage!.id },
  { userId: officer!.id, role: 'broker_of_record', orgId: brokerage!.id },
]).onConflictDoNothing();
await pool.end();
console.log(`seeded ${SAMPLE.length} listings, ${sold} sold comparables, ${AGENTS.length} agents and a compliance officer`);
