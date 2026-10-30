'use client';

import { StaffSignIn } from '@klyr/web-kit/staff-sign-in';
import { klyr } from '@/lib/client';

export default function SignInPage() {
  return <StaffSignIn client={klyr} app="Klyr Admin" roles={['compliance_officer', 'broker_of_record']} home="/id-reviews" />;
}
