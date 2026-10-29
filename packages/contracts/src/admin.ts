import { z } from 'zod';
import { STAFF_ROLES } from './roles.js';

/** PIPEDA: a person asks for their information, a correction, or deletion. */
export const PrivacyRequestRequest = z.object({
  kind: z.enum(['access', 'correction', 'deletion']),
  details: z.string().trim().max(2000).optional(),
}).refine(r => r.kind !== 'correction' || (r.details?.length ?? 0) >= 5, { message: 'Tell us what to correct.', path: ['details'] });
export type PrivacyRequestRequest = z.infer<typeof PrivacyRequestRequest>;

export const PrivacyDecision = z.object({ result: z.enum(['completed', 'denied']), response: z.string().trim().min(3).max(2000) });
export type PrivacyDecision = z.infer<typeof PrivacyDecision>;

/** Estimate defaults the brokerage publishes, with a note on why they changed. */
export const PublishAssumptionsRequest = z.object({
  rate: z.number().min(0.01).max(0.15),
  downPct: z.number().min(0.05).max(1),
  lawyerFee: z.number().int().min(0).max(10_000),
  note: z.string().trim().min(10).max(1000),
});
export type PublishAssumptionsRequest = z.infer<typeof PublishAssumptionsRequest>;

export const RoleChangeRequest = z.object({
  email: z.string().trim().email(),
  role: z.enum(STAFF_ROLES),
  action: z.enum(['grant', 'revoke']),
  /** Granting "agent": the name and title registered with RECO. */
  registeredName: z.string().trim().min(2).max(200).optional(),
  title: z.enum(['Salesperson', 'Broker']).optional(),
  recoNumber: z.string().trim().min(2).max(40).optional(),
});
export type RoleChangeRequest = z.infer<typeof RoleChangeRequest>;

export const SuspendListingRequest = z.object({ reason: z.string().trim().min(5).max(500) });
export type SuspendListingRequest = z.infer<typeof SuspendListingRequest>;
