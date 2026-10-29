import { z } from 'zod';

export const SignAgreementRequest = z.object({
  /** Must match the legal name on the account. */
  typedName: z.string().trim().min(2).max(200),
  readConfirmed: z.literal(true, { error: 'Confirm you have read the agreement' }),
});
export type SignAgreementRequest = z.infer<typeof SignAgreementRequest>;

export const SOURCES_OF_FUNDS = ['savings', 'sale_of_property', 'gift', 'investments', 'employment', 'other'] as const;

/** FINTRAC client information; the photo-ID check runs through the verification vendor. */
export const IdCheckRequest = z.object({
  occupation: z.string().trim().min(2).max(200),
  sourceOfFunds: z.array(z.enum(SOURCES_OF_FUNDS)).min(1, 'Pick at least one source'),
  actingForThirdParty: z.boolean(),
  politicallyExposed: z.boolean(),
  buyingAs: z.enum(['self', 'company']),
  /** Vendor session reference from the photo-ID step. "sandbox" only outside production. */
  vendorRef: z.string().min(1).max(200),
});
export type IdCheckRequest = z.infer<typeof IdCheckRequest>;

export const BookShowingRequest = z.object({
  listingId: z.uuid(),
  at: z.iso.datetime({ offset: true }),
  note: z.string().max(500).optional(),
});
export type BookShowingRequest = z.infer<typeof BookShowingRequest>;
