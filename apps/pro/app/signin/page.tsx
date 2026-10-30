'use client';

import { StaffSignIn } from '@klyr/web-kit/staff-sign-in';
import { klyr } from '@/lib/client';

export default function SignInPage() {
  return <StaffSignIn client={klyr} app="Klyr Pro" roles={['agent']} home="/" />;
}
