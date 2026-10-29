import { z } from 'zod';

/** Buyer journey from the prototype: Find your home → Secure the deal → Move in. */
export const DEAL_STAGES = ['searching', 'touring', 'offer', 'conditional', 'firm', 'closing', 'closed', 'released'] as const;
export const DealStage = z.enum(DEAL_STAGES);
export type DealStage = z.infer<typeof DealStage>;

/** OREA forms the app generates and signs. */
export const OREA_FORMS = {
  '100': 'Agreement of Purchase and Sale',
  '101': 'Agreement of Purchase and Sale – Condominium Resale',
  '120': 'Amendment to Agreement of Purchase and Sale',
  '122': 'Mutual Release',
  '200': 'Listing Agreement',
  '210': 'Listing Agreement – Lease',
  '300': 'Buyer Representation Agreement',
  '326': 'Consent for Multiple Representation',
  '346': 'Tenant Representation Agreement',
  '400': 'Agreement to Lease – Residential',
  '410': 'Rental Application – Residential',
} as const;
export type OreaForm = keyof typeof OREA_FORMS;

export const Condition = z.object({
  kind: z.enum(['financing', 'inspection', 'status_certificate', 'sale_of_buyer_home', 'other']),
  /** Business days after acceptance (financing 3–5, inspection 5–10 in the design). */
  days: z.number().int().positive(),
  dueAt: z.iso.datetime(),
  waivedAt: z.iso.datetime().nullable(),
});
export type Condition = z.infer<typeof Condition>;
