import { redirect } from 'next/navigation';
import { sessionToken } from '@/lib/session';
import { Onboarding } from './onboarding';

export const metadata = { title: 'Get started · Klyr' };

export default async function Start() {
  if (await sessionToken()) redirect('/');
  return <Onboarding />;
}
