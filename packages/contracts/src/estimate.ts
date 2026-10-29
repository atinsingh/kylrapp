import { z } from 'zod';

export const EstimateRequest = z.object({
  listingId: z.string().min(1),
  plan: z.number().min(0).max(100).optional(),
  firstTime: z.boolean().optional(),
  lawyer: z.number().nonnegative().optional(),
  downPct: z.number().min(0.05).max(1).optional(),
  rate: z.number().min(0).max(0.25).optional(),
});
export type EstimateRequest = z.infer<typeof EstimateRequest>;

const num = z.coerce.number();

/** Query string for GET /listings. */
export const ListingSearch = z.object({
  kind: z.enum(['sale', 'lease']).default('sale'),
  /** One city or a comma-separated list. */
  city: z.string().max(200).optional(),
  minPrice: num.int().nonnegative().optional(),
  maxPrice: num.int().positive().optional(),
  minBeds: num.int().nonnegative().optional(),
  type: z.enum(['House', 'Townhouse', 'Condo']).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest']).default('price_asc'),
  /** Specific homes, for Compare: comma-separated ids. */
  ids: z.string().regex(/^[0-9a-f-]{36}(,[0-9a-f-]{36}){0,9}$/).transform(s => s.split(',')).optional(),
  /** Only homes the user saved. */
  saved: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  /** "near=43.60,-79.59,1000": lat, lng, radius in metres (the 1 km map radius). */
  near: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,\d+$/).transform(s => {
    const [lat, lng, radiusM] = s.split(',').map(Number) as [number, number, number];
    return { lat, lng, radiusM };
  }).optional(),
});
export type ListingSearch = z.infer<typeof ListingSearch>;

/** "How we estimate" inputs a buyer can change. Plan % is set by their agreement, not here. */
export const Assumptions = z.object({
  rate: z.number().min(0.005).max(0.15),
  downPct: z.number().min(0.05).max(1),
  firstTime: z.boolean(),
  lawyerFee: z.number().int().min(0).max(10_000),
});
export type Assumptions = z.infer<typeof Assumptions>;

/** The filters a saved search keeps (the same ones as search). */
export const SearchFilters = z.object({
  city: z.string().trim().max(200).optional(),
  minPrice: z.number().int().nonnegative().optional(),
  maxPrice: z.number().int().positive().optional(),
  minBeds: z.number().int().nonnegative().max(10).optional(),
  type: z.enum(['House', 'Townhouse', 'Condo']).optional(),
});
export type SearchFilters = z.infer<typeof SearchFilters>;

export const SaveSearchRequest = z.object({
  name: z.string().trim().min(1).max(80),
  filters: SearchFilters,
  /** "instant": within minutes of a new listing or price drop; "daily": one morning email. */
  alert: z.enum(['instant', 'daily', 'off']).default('daily'),
});
export type SaveSearchRequest = z.infer<typeof SaveSearchRequest>;
export const UpdateSearchRequest = z.object({ alert: z.enum(['instant', 'daily', 'off']) });
