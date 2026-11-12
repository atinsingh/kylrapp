import { config } from '../config.js';

/** Photo-ID check against a FINTRAC-accepted method. The vendor is still to be chosen (Launch Checklist action 6). */
export interface IdVerifier {
  readonly vendor: string;
  /** Confirms the vendor session completed and returns what FINTRAC requires us to record. */
  verify(vendorRef: string): Promise<{ method: 'government_photo_id' | 'credit_file' | 'dual_process'; evidence: Record<string, unknown> }>;
}
export const ID_VERIFIER = Symbol('ID_VERIFIER');

/** Development stand-in. Accepts only the reference "sandbox" and is refused in production. */
export class SandboxIdVerifier implements IdVerifier {
  readonly vendor = 'sandbox';
  async verify(vendorRef: string) {
    if (vendorRef !== 'sandbox') throw new Error('unknown vendor session');
    return { method: 'government_photo_id' as const, evidence: { note: 'Sandbox check — no real document was examined.', document: 'Ontario driver’s licence (sample)' } };
  }
}

export function createIdVerifier(): IdVerifier {
  if (config.production) throw new Error('Connect a FINTRAC-compliant ID verification vendor before running in production');
  return new SandboxIdVerifier();
}
