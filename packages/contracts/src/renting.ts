import { z } from 'zod';

const t = (max = 200) => z.string().trim().min(1).max(max);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const rent = z.number().int().min(300).max(50_000);

/**
 * The tenant's profile, which fills Form 410 for every application. Only what the Human Rights Code
 * lets a landlord consider: income, employment, references, occupants, credit (with consent).
 */
export const TenantProfileRequest = z.object({
  monthlyIncome: z.number().int().min(0).max(1_000_000),
  employer: t(), jobTitle: t(),
  occupants: z.number().int().min(1).max(12),
  pets: z.string().trim().max(200).optional(),
  moveIn: day,
  references: z.array(z.object({ name: t(), phone: t(40), relation: z.enum(['landlord', 'employer', 'personal']) })).min(1).max(3),
  creditConsent: z.boolean(),
});
export type TenantProfileRequest = z.infer<typeof TenantProfileRequest>;

/** Form 410 + Form 400 together. The only deposit allowed is the last month's rent. */
export const RentalApplyRequest = z.object({
  rent, startDate: day, termMonths: z.number().int().min(1).max(24),
  typedName: t(), readConfirmed: z.literal(true),
});
export type RentalApplyRequest = z.infer<typeof RentalApplyRequest>;

export const LeaseStartRequest = z.object({
  address: t(), unit: z.string().trim().max(20).optional(), city: t(80),
  type: z.enum(['House', 'Townhouse', 'Condo']),
  beds: z.number().int().min(0).max(20), baths: z.number().int().min(0).max(20),
  sqft: z.number().int().positive().max(50_000).optional(),
  /** When the unit was first lived in: decides rent control. */
  firstOccupied: day,
  parking: z.string().trim().max(100).default(''), utilities: z.string().trim().max(200).default(''),
  furnished: z.boolean().default(false),
  description: t(2000),
  rent, availableFrom: day,
});
export type LeaseStartRequest = z.infer<typeof LeaseStartRequest>;

export const LeasePlanRequest = z.object({ rent, tenantSidePct: z.union([z.literal(0), z.literal(0.5), z.literal(1)]), availableFrom: day });
export type LeasePlanRequest = z.infer<typeof LeasePlanRequest>;

export const LeaseDecision = z.discriminatedUnion('result', [
  z.object({ result: z.literal('accepted'), typedName: t(), readConfirmed: z.literal(true) }),
  z.object({ result: z.literal('declined') }),
]);
export type LeaseDecision = z.infer<typeof LeaseDecision>;

/** A viewing of a rental. The tenant's agent confirms it and checks in at the home, as for a purchase. */
export const BookViewingRequest = z.object({
  at: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(500).optional(),
});
export type BookViewingRequest = z.infer<typeof BookViewingRequest>;

/** The landlord records each year's interest on the last month's rent deposit. */
export const LmrInterestRequest = z.object({ dueDate: day, method: z.enum(['paid', 'topped_up']) });
export type LmrInterestRequest = z.infer<typeof LmrInterestRequest>;
