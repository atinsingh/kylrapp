import { z } from 'zod';
import { CONSUMER_PLANS } from './roles.js';

/** Versions of the documents a user accepts at sign-up. Bump when legal changes the text. */
export const LEGAL_VERSIONS = {
  terms: '2026-10-27',
  vowTerms: '2026-10-27',
  privacyNotice: '2026-10-27',
  recoGuide: '2026-10-27',
} as const;

const email = z.email().max(254).transform(s => s.trim().toLowerCase());
const code = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const SignupRequest = z.object({
  legalName: z.string().trim().min(2).max(200),
  email,
  phone: z.string().trim().max(32).optional(),
  plan: z.enum(CONSUMER_PLANS),
  /** Answers from "Tell us about your move". */
  setup: z.record(z.string(), z.unknown()).default({}),
  dealUpdates: z.boolean().default(true),
  marketing: z.boolean().default(false),
  /** Both must be true; the API records the versions above. */
  acceptTerms: z.literal(true, { error: 'Accept the terms to continue' }),
  acceptPrivacy: z.literal(true, { error: 'Read the privacy notice to continue' }),
  recoGuideRead: z.literal(true, { error: 'Read the RECO guide to continue' }),
});
export type SignupRequest = z.infer<typeof SignupRequest>;

export const EmailStartRequest = z.object({ email });
export const EmailVerifyRequest = z.object({ email, code });
export const PasswordSetRequest = z.object({ password: z.string().min(12, 'Use at least 12 characters').max(256) });
export const PasswordLoginRequest = z.object({ email, password: z.string().min(1).max(256) });
export const TotpCodeRequest = z.object({ code });
export const PasskeyLoginVerifyRequest = z.object({ challengeId: z.uuid(), response: z.record(z.string(), z.unknown()) });
export const PasskeyRegisterVerifyRequest = z.object({ challengeId: z.uuid(), response: z.record(z.string(), z.unknown()), name: z.string().max(80).optional() });

export type EmailStartRequest = z.infer<typeof EmailStartRequest>;
export type EmailVerifyRequest = z.infer<typeof EmailVerifyRequest>;
export type PasswordSetRequest = z.infer<typeof PasswordSetRequest>;
export type PasswordLoginRequest = z.infer<typeof PasswordLoginRequest>;
export type TotpCodeRequest = z.infer<typeof TotpCodeRequest>;
export type PasskeyLoginVerifyRequest = z.infer<typeof PasskeyLoginVerifyRequest>;
export type PasskeyRegisterVerifyRequest = z.infer<typeof PasskeyRegisterVerifyRequest>;

/** Returned by every endpoint that signs someone in. Web strips `token` into an httpOnly cookie. */
export interface SessionResponse {
  session: { token: string; expiresAt: string; mfaRequired: boolean };
  user: Me;
}

export interface Me {
  id: string;
  email: string;
  legalName: string | null;
  emailVerified: boolean;
  roles: string[];
  hasPassword: boolean;
  passkeys: number;
  totpEnabled: boolean;
}
