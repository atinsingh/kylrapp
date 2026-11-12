'use client';

import { StaffSignIn } from '@klyr/web-kit/staff-sign-in';
import { klyr } from '@/lib/client';

/** Lenders, lawyers, inspectors and insurers linked to a firm by Klyr. Same sign-in as staff: email code, then an authenticator. */
export default function PartnerSignInPage() {
  return <StaffSignIn client={klyr} app="Klyr Partners" roles={['lender', 'lawyer', 'inspector', 'insurer']} home="/partner" />;
}
