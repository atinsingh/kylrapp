import { z } from 'zod';

/** Limits the API enforces on an offer, shared so the apps can explain them. */
export const OFFER_RULES = {
  defaultDepositPct: 5,
  /** Conditions run in banking days after acceptance. */
  maxConditionDays: 10,
  defaultConditionDays: 5,
  /** The offer must stay open at least this long, and not longer than this, from signing. */
  minIrrevocableHours: 2,
  maxIrrevocableDays: 7,
  minClosingDays: 14,
  maxClosingDays: 365,
  /** Deposit "upon acceptance" means within 24 hours of acceptance. */
  depositDueHours: 24,
} as const;

const days = z.number().int().min(1).max(OFFER_RULES.maxConditionDays).nullable();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-01-15');

/** The buyer's offer terms, saved as a draft until signed. */
export const OfferTerms = z.object({
  listingId: z.string().uuid(),
  price: z.number().int().positive(),
  deposit: z.number().int().nonnegative(),
  financingDays: days,
  inspectionDays: days,
  /** Condo resales only (Form 101): the buyer's lawyer reviews the status certificate. */
  statusCertificateDays: days,
  irrevocableAt: z.string().datetime({ offset: true }),
  closingDate: ymd,
  inclusions: z.string().trim().max(500),
  exclusions: z.string().trim().max(500).default(''),
  noteToAgent: z.string().trim().max(1000).default(''),
});
export type OfferTerms = z.infer<typeof OfferTerms>;

export const SignOfferRequest = z.object({
  typedName: z.string().trim().min(2).max(200),
  readConfirmed: z.literal(true),
});
export type SignOfferRequest = z.infer<typeof SignOfferRequest>;

/** The agent's review of an offer their client signed. */
export const ReviewOfferRequest = z.discriminatedUnion('action', [
  /** Sent to the listing brokerage, which confirmed receipt (Form 801). */
  z.object({ action: z.literal('register'), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('return'), note: z.string().trim().min(3, 'Tell your client what to change').max(1000) }),
]);
export type ReviewOfferRequest = z.infer<typeof ReviewOfferRequest>;

/** What the seller did, recorded by the buyer's agent. */
export const OfferResultRequest = z.discriminatedUnion('result', [
  z.object({ result: z.literal('accepted'), note: z.string().trim().max(1000).optional() }),
  z.object({
    result: z.literal('signed_back'),
    price: z.number().int().positive(),
    irrevocableAt: z.string().datetime({ offset: true }),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ result: z.literal('rejected'), note: z.string().trim().max(1000).optional() }),
]);
export type OfferResultRequest = z.infer<typeof OfferResultRequest>;

/** The buyer's answer to a sign-back. Accepting is a signature. */
export const SignBackResponse = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('accept'), typedName: z.string().trim().min(2).max(200), readConfirmed: z.literal(true) }),
  z.object({ decision: z.literal('decline'), note: z.string().trim().max(1000).optional() }),
]);
export type SignBackResponse = z.infer<typeof SignBackResponse>;

/** Form 123: the buyer waives a condition or confirms it's fulfilled. A signature. */
export const ConditionNoticeRequest = z.object({
  action: z.enum(['waive', 'fulfil']),
  typedName: z.string().trim().min(2).max(200),
  readConfirmed: z.literal(true),
});
export type ConditionNoticeRequest = z.infer<typeof ConditionNoticeRequest>;

/** The agent's record of the phone call that confirmed the trust account details. */
export const TrustVerifiedRequest = z.object({
  note: z.string().trim().min(3, 'Say who you spoke to and the number you called').max(500),
});
export type TrustVerifiedRequest = z.infer<typeof TrustVerifiedRequest>;

/** Form 120: move closing and/or extend conditions. Signed by the buyer, then presented to the seller. */
export const AmendmentRequest = z.object({
  closingDate: ymd.optional(),
  extend: z.array(z.object({ conditionId: z.string().uuid(), until: ymd })).max(5).default([]),
  typedName: z.string().trim().min(2).max(200),
  readConfirmed: z.literal(true),
}).refine(a => a.closingDate || a.extend.length, { message: 'Change the closing date or extend a condition' });
export type AmendmentRequest = z.infer<typeof AmendmentRequest>;

export const AmendmentResultRequest = z.object({
  result: z.enum(['accepted', 'rejected']),
  note: z.string().trim().max(1000).optional(),
});
export type AmendmentResultRequest = z.infer<typeof AmendmentResultRequest>;

/** The buyer's closing checklist. The agent marks the final walk-through. */
const text = (max = 200) => z.string().trim().min(1).max(max);
export const DealTaskRequest = z.discriminatedUnion('key', [
  z.object({ key: z.literal('lawyer'), name: text(), firm: text(), email: z.string().trim().email(), phone: z.string().trim().max(40).optional() }),
  z.object({ key: z.literal('mortgage'), lender: text() }),
  z.object({ key: z.literal('insurance'), insurer: text(), policy: z.string().trim().max(100).optional() }),
  z.object({ key: z.literal('adjustments') }),
  z.object({ key: z.literal('walkthrough'), note: z.string().trim().max(500).optional() }),
]);
export type DealTaskRequest = z.infer<typeof DealTaskRequest>;
export const DEAL_TASKS = ['lawyer', 'mortgage', 'insurance', 'adjustments', 'walkthrough'] as const;

/** Klyr Admin records the commission the listing brokerage paid, then the cash-back EFT. */
export const CommissionReceivedRequest = z.object({ amount: z.number().int().positive() });
export const PayoutSentRequest = z.object({ reference: z.string().trim().min(3, 'Add the bank’s EFT reference').max(100) });
