import { redirect } from 'next/navigation';
import { sessionToken } from '@/lib/session';
import { SignIn } from './signin';

export const metadata = { title: 'Sign in · Klyr' };

export default async function SignInPage() {
  if (await sessionToken()) redirect('/');
  return <SignIn />;
}
