import { z } from 'zod';

const ids = z.array(z.string().uuid()).min(1).max(4);
const note = z.string().trim().max(500).optional();
const dollars = z.number().int().min(0).max(5_000_000);

export const QUOTE_KINDS = ['lender', 'lawyer', 'inspector', 'insurer'] as const;
export type QuoteKind = (typeof QUOTE_KINDS)[number];

/** Ask 1–4 providers of one kind for a quote. */
export const QuoteRequestRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lender'), providerIds: ids, loan: z.number().int().min(50_000).max(10_000_000), amortYears: z.union([z.literal(25), z.literal(30)]), note }),
  z.object({ kind: z.literal('lawyer'), providerIds: ids, price: z.number().int().min(50_000).max(50_000_000), note }),
  z.object({ kind: z.literal('inspector'), providerIds: ids, note }),
  z.object({ kind: z.literal('insurer'), providerIds: ids, homeValue: z.number().int().min(50_000).max(50_000_000), note }),
]);
export type QuoteRequestRequest = z.infer<typeof QuoteRequestRequest>;

const common = { providerId: z.string().uuid(), referralFee: dollars, validDays: z.number().int().min(1).max(120) };
/** The agent enters a quote from the provider's own system. Ranking uses only what the client pays. */
export const EnterQuoteRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lender'), ...common, rate: z.number().min(0.005).max(0.2), fees: dollars, prepaymentPct: z.number().int().min(0).max(100), approvalDays: z.number().int().min(0).max(60) }),
  z.object({ kind: z.literal('lawyer'), ...common, fee: dollars, disbursements: dollars, titleInsurance: dollars }),
  z.object({ kind: z.literal('inspector'), ...common, price: dollars, reportHours: z.number().int().min(1).max(240) }),
  z.object({ kind: z.literal('insurer'), ...common, annualPremium: dollars, deductible: dollars }),
]);
export type EnterQuoteRequest = z.infer<typeof EnterQuoteRequest>;

/** Choosing a quote. When the provider pays Klyr a referral fee, the client acknowledges it in writing first. */
export const ChooseQuoteRequest = z.object({ referralAcknowledged: z.boolean() });
export type ChooseQuoteRequest = z.infer<typeof ChooseQuoteRequest>;
