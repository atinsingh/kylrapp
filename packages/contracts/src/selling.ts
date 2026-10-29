import { z } from 'zod';

const t = (max = 200) => z.string().trim().min(1).max(max);
const money = z.number().int().nonnegative();

/** Coop offered to the buyer's brokerage: the seller decides, between 1% and 3% (Ontario norm 2.5%). */
export const COOP_CHOICES = [0.015, 0.02, 0.025] as const;

export const SellStartRequest = z.object({
  address: t(), unit: z.string().trim().max(20).optional(), city: t(80),
  type: z.enum(['House', 'Townhouse', 'Condo']),
  beds: z.number().int().min(0).max(20), baths: z.number().int().min(0).max(20),
  sqft: z.number().int().positive().max(50_000).optional(), yearBuilt: z.number().int().min(1800).max(2100).optional(),
  annualTax: money.optional(), condoFee: money.optional(),
  listPrice: z.number().int().min(50_000).max(50_000_000), mortgageBalance: money.default(0),
});
export type SellStartRequest = z.infer<typeof SellStartRequest>;

export const SellPlanRequest = z.object({
  plan: z.enum(['flat', 'percent']),
  coop: z.number().min(0.01).max(0.03),
  listPrice: z.number().int().min(50_000).max(50_000_000),
  mortgageBalance: money,
});
export type SellPlanRequest = z.infer<typeof SellPlanRequest>;

/** Prep checklist: the seller's steps, and the agent's (photos, inspection). */
export const SellTaskRequest = z.discriminatedUnion('key', [
  z.object({ key: z.literal('payout'), lender: t(), balance: money }),
  z.object({ key: z.literal('rules'), offerDate: z.string().trim().max(80).optional(), showings: t(300) }),
  z.object({ key: z.literal('approve'), description: t(2000), inclusions: t(500) }),
  z.object({ key: z.literal('photos'), note: z.string().trim().max(300).optional() }),
  z.object({ key: z.literal('inspection'), note: z.string().trim().max(300).optional() }),
]);
export type SellTaskRequest = z.infer<typeof SellTaskRequest>;
export const SELL_TASKS = ['payout', 'photos', 'inspection', 'rules', 'approve'] as const;

/** The agent publishes the listing: coordinates (no geocoder yet) and the photo URLs from the media vendor. */
export const PublishListingRequest = z.object({
  lat: z.number().min(41).max(57), lng: z.number().min(-96).max(-74),
  photos: z.array(z.string().url()).max(40).default([]),
});
export type PublishListingRequest = z.infer<typeof PublishListingRequest>;

/** The buyer's side of multiple representation (Form 326) for one Klyr listing. */
export const BuyerConsentRequest = z.object({
  listingId: z.string().uuid(),
  typedName: t(),
  readConfirmed: z.literal(true),
});
export type BuyerConsentRequest = z.infer<typeof BuyerConsentRequest>;

/** After a completed visit: what the buyer thought. A Klyr seller sees it without the buyer's name. */
export const VisitFeedbackRequest = z.object({
  interest: z.enum(['yes', 'maybe', 'no']),
  price: z.enum(['low', 'fair', 'high']),
  comment: z.string().trim().max(500).optional(),
});
export type VisitFeedbackRequest = z.infer<typeof VisitFeedbackRequest>;

/** A Klyr seller answers an offer on their home. Accepting and signing back are signatures. */
export const SellerOfferDecision = z.discriminatedUnion('result', [
  z.object({ result: z.literal('accepted'), typedName: t(), readConfirmed: z.literal(true) }),
  z.object({
    result: z.literal('signed_back'), price: z.number().int().positive(), irrevocableAt: z.string().datetime({ offset: true }),
    typedName: t(), readConfirmed: z.literal(true),
  }),
  z.object({ result: z.literal('rejected') }),
]);
export type SellerOfferDecision = z.infer<typeof SellerOfferDecision>;
