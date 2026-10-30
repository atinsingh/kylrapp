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

/** An agent's decision on a requested visit. Moving or declining needs a note for the buyer. */
export const DecideShowingRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm'), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('move'), at: z.iso.datetime({ offset: true }), note: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal('decline'), note: z.string().trim().min(3).max(500) }),
]);
export type DecideShowingRequest = z.infer<typeof DecideShowingRequest>;

/** Compliance officer's decision on an ID check that needed review. */
export const ReviewIdRequest = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().min(3, 'Add a short note for the record').max(1000),
});
export type ReviewIdRequest = z.infer<typeof ReviewIdRequest>;

/** A location reading from the agent's device for geofenced check-in and check-out. */
export const GeoCheckRequest = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Reported accuracy radius in metres. */
  accuracyM: z.number().nonnegative().max(100_000),
  /** Android reports locations from mock-location apps; such readings are refused. */
  mocked: z.boolean().optional(),
  /** Check-in is from the Klyr phone app (native GPS, mock-location flag). Web readings are refused outside development. */
  platform: z.enum(['ios', 'android', 'web']),
});
export type GeoCheckRequest = z.infer<typeof GeoCheckRequest>;

/** Geofence rules, shared so the app can explain them. */
export const GEOFENCE = { radiusM: 150, maxAccuracyM: 100, earlyMinutes: 30, lateMinutes: 120, minOnSiteMinutes: 10 } as const;

/** A phone registering for push (Expo push token). */
export const RegisterDeviceRequest = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Not a push token'),
  platform: z.enum(['ios', 'android']),
});
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequest>;
